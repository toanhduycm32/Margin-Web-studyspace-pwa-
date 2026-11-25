import { expect, it } from "vitest";
import { generateChunkQuestions, summarizeChunk } from "./nvidia";

// Opt in explicitly: this test makes real NVIDIA calls and consumes provider quota.
it.skipIf(process.env.RUN_LIVE_EVAL !== "1")("reviews a source-backed summary and mixed-format assessment", async () => {
  const source = `Page 1
Chapter 1 Gradient Descent
Gradient descent minimizes a differentiable objective by repeatedly moving parameters opposite the gradient of the loss. For a scalar parameter, the update is theta_new = theta_old - alpha * dL/dtheta, where alpha is a positive learning rate. A stationary point has zero gradient, but it is not necessarily a minimum; it can be a maximum or a saddle point. The method is local and its result can depend on initialization.

Page 2
Chapter 2 Learning Rate and Evidence
A learning rate that is too large can overshoot a minimum or diverge. A smaller learning rate can improve stability, but may require more steps. A fixed learning rate is simple; a schedule can reduce the rate over time. Convergence claims require assumptions about the objective and step size. For a convex differentiable objective, every local minimum is global, but a nonconvex objective can have multiple local minima. Stopping when the loss changes little is a practical criterion, not a proof of a global optimum.

Page 3
Chapter 3 Generalization
Minimizing training loss does not alone establish generalization. A separate validation set estimates behavior on unseen examples when it is not used to fit the model. Repeated tuning on the validation set can itself overfit that set. A final held-out test set provides a less biased estimate when it is used only after model selection.`;
  const reserve = async () => {};
  const summary = await summarizeChunk(source, 1, 3, "academic", "Gradient Descent and Evaluation", "heading", 190, reserve);
  const questions = await generateChunkQuestions(source,
    ["select_all", "select_n", "single_best"], ["mechanism", "application", "assumption"],
    1, 3, "Gradient Descent and Evaluation", reserve);
  expect(summary.length).toBeGreaterThan(250);
  expect(questions).toHaveLength(3);
  expect(questions[0].correctOptionIds.length).toBeGreaterThan(1);
  expect(questions[1].selectionCount).toBe(questions[1].correctOptionIds.length);
  console.log("LIVE_SUMMARY", summary);
  console.log("LIVE_QUESTIONS", JSON.stringify(questions));
}, 240_000);
