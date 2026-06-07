import { useSelector, useDispatch } from 'react-redux';

interface CartItem {
  id: string;
  qty: number;
}

interface RootState {
  cart: { items: CartItem[] };
}

export function useCart() {
  const items = useSelector((s: RootState) => s.cart.items);
  const dispatch = useDispatch();
  return {
    items,
    add: (item: CartItem) => dispatch({ type: 'cart/add', payload: item }),
    clear: () => dispatch({ type: 'cart/clear' }),
  };
}
