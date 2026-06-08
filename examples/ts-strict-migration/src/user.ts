export interface User {
  id: string;
  name: string;
  metadata: any;
}

export function loadUser(raw: any): User {
  return raw as User;
}
