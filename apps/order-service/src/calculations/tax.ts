export const calculateTax = (subtotal: number): number => {
  const TAX_RATE = 0.05; // 5%
  return parseFloat((subtotal * TAX_RATE).toFixed(2));
};

export const calculateTotal = (subtotal: number, tax: number): number => {
  return parseFloat((subtotal + tax).toFixed(2));
};
