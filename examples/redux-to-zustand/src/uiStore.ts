import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  setSidebar: (open: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: false,
  setSidebar: (open) => set({ sidebarOpen: open }),
}));
