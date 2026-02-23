// Test fixture: function values annotated with Kind types.

type PropertySpec = {
  readonly pure?: true;
  readonly noIO?: true;
  readonly noMutation?: true;
};

type Kind<
  Base = unknown,
  _Properties extends PropertySpec = {},
> = Base & {
  readonly __ks?: true;
};

type PureFn = Kind<Function, { pure: true, noIO: true }>;

const calculateTotal: PureFn = (items: { price: number }[]) =>
  items.reduce((sum, i) => sum + i.price, 0);

const greet: Kind<(name: string) => string, { pure: true }> =
  (name) => `Hello, ${name}!`;
