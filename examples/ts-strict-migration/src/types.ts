export type Cents = number;

export type Money = {
  amount: Cents;
  currency: 'EUR' | 'USD';
};
