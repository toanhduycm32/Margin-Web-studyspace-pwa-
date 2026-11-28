type PickerWindow = Window & { gapi?: { load: (name: string, callback: () => void) => void }; google?: { picker: any } };

let loading: Promise<void> | null = null;

function loadPicker(): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const current = window as PickerWindow;
    const ready = () => {
      if (!current.gapi) { reject(new Error("Google Picker did not load.")); return; }
      current.gapi.load("picker", resolve);
    };
    if (current.google?.picker && current.gapi) { resolve(); return; }
    if (current.gapi) { ready(); return; }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js"; script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error("Google Picker script could not load."));
    document.head.appendChild(script);
  }).catch((error) => { loading = null; throw error; });
  return loading;
}

export async function openPdfPicker(accessToken: string, onPicked: (ids: string[]) => void): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
  if (!apiKey || !appId) throw new Error("Google Picker configuration is missing.");
  await loadPicker();
  const picker = (window as PickerWindow).google?.picker;
  if (!picker) throw new Error("Google Picker is unavailable.");
  const docs = new picker.DocsView().setMimeTypes("application/pdf").setIncludeFolders(false);
  new picker.PickerBuilder()
    .setLocale("vi")
    .addView(docs)
    .addView(new picker.DocsUploadView())
    .setOAuthToken(accessToken)
    .setDeveloperKey(apiKey)
    .setAppId(appId)
    .setOrigin(window.location.origin)
    .setCallback((event: Record<string, unknown>) => {
      if (event[picker.Response.ACTION] !== picker.Action.PICKED) return;
      const documents = event[picker.Response.DOCUMENTS];
      if (!Array.isArray(documents)) return;
      const ids = documents.map((item: Record<string, unknown>) => item[picker.Document.ID])
        .filter((id: unknown): id is string => typeof id === "string");
      if (ids.length) onPicked(ids);
    }).build().setVisible(true);
}
