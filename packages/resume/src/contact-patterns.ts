// Contact-detail patterns shared by the ATS PDF analyzer and the server-side AI redaction layer.
// The global (`g`) patterns carry `lastIndex` state: use them with `match`/`replace`, or clone them
// (`new RegExp(pattern.source, pattern.flags)`) before calling `.test()` or `.exec()`.

export const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** Same shape without `g`: a stateful `lastIndex` would make `.test()` alternate between calls. */
export const EMAIL_TEST = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
export const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
export const BARE_DOMAIN_PATTERN =
	/\b(?:[\w-]+\.)+(?:com|org|net|io|dev|me|co|ai|app|xyz|edu|gov)(?:\/[^\s<>"')\]]*)?/gi;

export const PROFESSIONAL_HOSTS = [
	"linkedin.com",
	"github.com",
	"gitlab.com",
	"behance.net",
	"dribbble.com",
	"medium.com",
];
