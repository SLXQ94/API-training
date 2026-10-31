/** "samay  BADGOTIYA" -> "Samay Badgotiya": first letter of every word upper-case, the rest lower-case. */
export function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const [first, ...rest] = Array.from(word); // Array.from keeps emoji / accented letters in one piece
      return first.toLocaleUpperCase() + rest.join('').toLocaleLowerCase();
    })
    .join(' ');
}
