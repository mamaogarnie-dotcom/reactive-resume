// Contact-detail patterns shared by the ATS PDF analyzer and the server-side AI redaction layer.
// The global (`g`) patterns carry `lastIndex` state: use them with `match`/`replace`, or clone them
// (`new RegExp(pattern.source, pattern.flags)`) before calling `.test()` or `.exec()`.
//
// Every repeated part of the e-mail patterns is bounded (local part 64, domain label 63, RFC 5321).
// An unbounded local part made a failed match restart a scan to the end of the text at every
// character, which costs seconds on a 50 000-character input without any `@`. Whole-address length is
// deliberately not capped at 254: a longer string would then be left unredacted.

export const EMAIL_PATTERN = /[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+/g;
/** Same shape without `g`: a stateful `lastIndex` would make `.test()` alternate between calls. */
export const EMAIL_TEST = /[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+/;
/**
 * An address broken up by PDF text extraction: `jan@ gmail.com`, `jan @ gmail . COM`, `jan@gmail.\ncom`.
 * A domain label after whitespace counts only when it is all lower case or all upper case and is not
 * followed by another letter, so the next sentence (`jan@firma.pl. Dalej`, `… . ZESPÓŁ`) stays.
 */
export const SPACED_EMAIL_PATTERN =
	/[\w.+-]{1,64}[ \t]{0,3}@[ \t]{0,3}[\w-]{1,63}(?:[ \t]{0,3}\.(?:[\w-]{1,63}|(?:[ \t]{1,3}\n?|\n)[ \t]{0,3}(?:[a-z]{2,24}|[A-Z]{2,24})(?![\p{L}\p{N}_-])))+/gu;
/** {@link SPACED_EMAIL_PATTERN} without `g`, for `.test()`. */
export const SPACED_EMAIL_TEST = new RegExp(SPACED_EMAIL_PATTERN.source, "u");
export const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
/** Bounded like the e-mail patterns: an unbounded label chain made `a.a.a.…` quadratic. */
export const BARE_DOMAIN_PATTERN =
	/\b(?:[\w-]{1,63}\.){1,8}(?:com|org|net|io|dev|me|co|ai|app|xyz|edu|gov)(?:\/[^\s<>"')\]]*)?/gi;

export const PROFESSIONAL_HOSTS = [
	"linkedin.com",
	"github.com",
	"gitlab.com",
	"behance.net",
	"dribbble.com",
	"medium.com",
];
