/**
 * Strict OSLC Query 3.0 §7.3 oslc.searchTerms parser.
 *
 *   searchTerms  := quotedString ( "," quotedString )*
 *   quotedString := '"' ( escapedChar | safeChar )* '"'
 *   escapedChar  := '\"' | '\\'
 *   safeChar     := any char except '"' and '\'
 *
 * Empty input → MalformedSearchTermsError. Empty quoted string → error.
 * Whitespace allowed around commas but not inside quotedString tokens
 * (whitespace inside a quoted string is part of the term).
 */

export class MalformedSearchTermsError extends Error {
  public readonly input: string;
  public constructor(message: string, input: string) {
    super(message);
    this.name = "MalformedSearchTermsError";
    this.input = input;
  }
}

export function parseSearchTerms(raw: string): string[] {
  const input = raw;
  let i = 0;
  const terms: string[] = [];

  const skipWs = () => {
    while (i < input.length && (input[i] === " " || input[i] === "\t")) i++;
  };

  const parseQuoted = (): string => {
    if (input[i] !== '"') {
      throw new MalformedSearchTermsError(
        `Expected '\"' at position ${i}`,
        input,
      );
    }
    i++; // consume opening quote
    let out = "";
    while (i < input.length && input[i] !== '"') {
      if (input[i] === "\\") {
        i++;
        if (i >= input.length) {
          throw new MalformedSearchTermsError(
            "Unterminated escape sequence",
            input,
          );
        }
        if (input[i] === '"' || input[i] === "\\") {
          out += input[i];
          i++;
        } else {
          throw new MalformedSearchTermsError(
            `Invalid escape \\${input[i]} at position ${i}`,
            input,
          );
        }
      } else {
        out += input[i];
        i++;
      }
    }
    if (i >= input.length) {
      throw new MalformedSearchTermsError("Unterminated quoted string", input);
    }
    i++; // consume closing quote
    if (out.length === 0) {
      throw new MalformedSearchTermsError("Empty quoted string", input);
    }
    return out;
  };

  if (input.length === 0) {
    throw new MalformedSearchTermsError("Empty searchTerms", input);
  }

  skipWs();
  terms.push(parseQuoted());
  skipWs();
  while (i < input.length) {
    if (input[i] !== ",") {
      throw new MalformedSearchTermsError(
        `Expected ',' at position ${i}`,
        input,
      );
    }
    i++; // consume comma
    skipWs();
    terms.push(parseQuoted());
    skipWs();
  }
  return terms;
}
