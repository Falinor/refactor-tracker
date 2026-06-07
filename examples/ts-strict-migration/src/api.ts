export async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  return res.json();
}
