// File that violates noMutation — contains assignment and increment
export const mutate = (arr: number[]) => {
  let x = 0;
  x = 1;
  x++;
};
