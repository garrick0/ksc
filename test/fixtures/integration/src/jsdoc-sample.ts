// JSDoc comment coverage

/**
 * A person with a name and age.
 * @template T - The type of metadata
 */
export interface Person<T> {
  /** The full name */
  name: string;
  /** Age in years */
  age: number;
  /** Optional metadata */
  meta?: T;
}

/**
 * Greets a person by name.
 * @param {string} name - The name to greet
 * @returns {string} The greeting message
 * @example
 * greet('Alice') // => 'Hello, Alice!'
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

/**
 * Calculates the sum of numbers.
 * @param {...number} nums - Numbers to sum
 * @see {@link greet}
 * @deprecated Use `total` instead
 * @throws {Error} If no numbers provided
 */
export function sum(...nums: number[]): number {
  if (nums.length === 0) throw new Error('No numbers');
  return nums.reduce((a, b) => a + b, 0);
}

/**
 * @typedef {Object} Config
 * @property {string} host - The hostname
 * @property {number} port - The port number
 */

/** @type {Record<string, number>} */
const cache: Record<string, number> = {};

/**
 * A tagged class.
 * @class
 * @implements {Person<string>}
 */
export class Employee implements Person<string> {
  name: string;
  age: number;
  meta?: string;

  /**
   * @param {string} name - Employee name
   * @param {number} age - Employee age
   */
  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  /** @override */
  toString(): string {
    return `${this.name} (${this.age})`;
  }
}
