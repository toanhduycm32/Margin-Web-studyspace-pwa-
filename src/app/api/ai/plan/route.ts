import { withSession } from "@/lib/server/session";

// Old open tabs must reload instead of spending inference on the retired planner.
export async function POST(request: Request) {
  return withSession(request, async () => Response.json({
    error: "Margin đã chuyển sang tạo câu hỏi trực tiếp theo phần nguồn. Tải lại ứng dụng.",
  }, { status: 410 }));
}
