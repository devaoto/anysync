// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type SortableValue = string | any[] | Record<string, unknown>;

/**
 * Sorts the keys of an object based on the length of their values.
 * - If the value is a string, it uses the string length.
 * - If the value is an array, it uses the array length.
 * - If the value is an object, it uses the number of keys.
 *
 * @param obj - The object to sort.
 * @returns A new object with keys sorted by value length.
 */
export function sortKeysByValueLength<T extends Record<string, SortableValue>>(
  obj: T
): T {
  const sortedEntries = Object.entries(obj).sort(([, valueA], [, valueB]) => {
    const lengthA = getLength(valueA);
    const lengthB = getLength(valueB);
    return lengthA - lengthB;
  });

  // Rebuild the object with sorted entries.
  return Object.fromEntries(sortedEntries) as T;
}

/**
 * Determines the "length" of a value for sorting purposes.
 * - If it's a string, returns the string length.
 * - If it's an array, returns the array length.
 * - If it's an object, returns the number of keys.
 * - For all other types, returns 0.
 *
 * @param value - The value whose length to determine.
 * @returns The determined length of the value.
 */
function getLength(value: SortableValue): number {
  if (typeof value === "string") {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }
  return 0;
}
