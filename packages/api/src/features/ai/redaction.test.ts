import { describe, expect, it } from "vitest";
import { EMAIL_PATTERN, SPACED_EMAIL_PATTERN } from "@reactive-resume/resume/contact-patterns";
import {
	buildAiRedactionContext,
	containsAiRedactionPlaceholder,
	normalizeTextForAi,
	redactContactLinePhones,
	redactTextForAi,
	redactValuesForAi,
} from "./redaction";

const identity = {
	firstName: "Anna",
	lastName: "Zielińska",
	email: "anna.zielinska@example.test",
	phone: "+48 601 234 567",
	linkedinUrl: "https://www.linkedin.com/in/anna-zielinska/",
	websiteUrl: "https://annazielinska.pl",
};

const context = buildAiRedactionContext([identity]);
const patternsOnly = buildAiRedactionContext([]);

describe("redactTextForAi: contact patterns", () => {
	it.each([
		["Contact: jan.kowalski@firma.pl for details.", "Contact: [EMAIL] for details."],
		["Profile https://www.linkedin.com/in/jan-kowalski", "Profile [URL]"],
		["See linkedin.com/in/jan-kowalski today", "See [URL] today"],
		["Portfolio: www.example.com/portfolio.", "Portfolio: [URL]."],
		["Portfolio: portfolio.pl/cv", "Portfolio: [URL]"],
		["Mobile +48 601 234 567.", "Mobile [TELEFON]."],
		["Mobile +48601234567", "Mobile [TELEFON]"],
		["Call 0048 601 234 567", "Call [TELEFON]"],
		["Call 601 234 567 or 601-234-567", "Call [TELEFON] or [TELEFON]"],
		["Office (12) 345 67 89", "Office [TELEFON]"],
		["Office 12 345 67 89", "Office [TELEFON]"],
		["tel. 601234567", "tel. [TELEFON]"],
		["UK +44 20 7946 0958", "UK [TELEFON]"],
	])("redacts %j", (input, expected) => {
		expect(redactTextForAi(input, patternsOnly)).toBe(expected);
	});

	it.each([
		"Prepared 483 offers and contracts worth PLN 2.89 million.",
		"Prepared 483 offers resulting in contracts worth 2,89 mln PLN.",
		"Project manager 2019–2023 and coordinator 2019-2023.",
		"Reduced costs by 15% in 12 months.",
		"Managed a team of 27 people.",
		"Budget of 125 000 000 PLN and 500 000 000 zł.",
		"Revenue 601 234 567 PLN.",
		"Sold 1 250 000 units between 01.02.2020 and 31.12.2023.",
		"Invoice no. 123456789 processed.",
		"Worked for Booking.com and Allegro.pl in Wrocław.",
		"Built services in ASP.NET/MVC and Node.js.",
		"MS Office - Word, Excel, Outlook",
	])("keeps professional facts unchanged: %j", (input) => {
		expect(redactTextForAi(input, patternsOnly)).toBe(input);
	});

	it.each([
		["See LinkedIn.com/in/jan-kowalski today", "See [URL] today"],
		["Code on GitHub.com/jan-kowalski", "Code on [URL]"],
		["Portfolio: Portfolio.PL/cv", "Portfolio: [URL]"],
		["See LINKEDIN.COM/in/x", "See [URL]"],
	])("redacts a link regardless of host case: %j", (input, expected) => {
		expect(redactTextForAi(input, patternsOnly)).toBe(expected);
	});

	it.each(["Built ASP.NET/MVC apps.", "Built asp.net/mvc apps.", "Built Asp.Net/MVC apps.", "Used VB.NET/WinForms."])(
		"keeps listed technology names written like a link: %j",
		(input) => {
			expect(redactTextForAi(input, patternsOnly)).toBe(input);
		},
	);

	it("keeps null and empty values", () => {
		expect(redactTextForAi(null, context)).toBeNull();
		expect(redactTextForAi("", context)).toBe("");
	});
});

describe("redactTextForAi: addresses", () => {
	it.each([
		["Adres: ul. Polna 5", "Adres: [ADRES]"],
		["Mieszkam: al. Jana Pawła II 12/4.", "Mieszkam: [ADRES]."],
		["os. Kościuszki 3 w Krakowie", "[ADRES] w Krakowie"],
		["ulica Długa 10 m. 2", "[ADRES]"],
		["Aleja 3 Maja 7a", "[ADRES]"],
		["UL. Polna 5, 00-950 Warszawa", "[ADRES] Warszawa"],
		["ul. Polna 5,00-950 Warszawa", "[ADRES] Warszawa"],
		["ul. Polna 5,00-950", "[ADRES]"],
		["Kod 00-950 Warszawa", "Kod [ADRES] Warszawa"],
		["ul. Dywizjonu 303 12/4", "[ADRES]"],
		["ul. Polna 5-7", "[ADRES]"],
		["ul. Polna 5-7, 00-950 Kraków", "[ADRES] Kraków"],
	])("redacts %j", (input, expected) => {
		expect(redactTextForAi(input, patternsOnly)).toBe(expected);
	});

	it.each([
		"Zespół 10-200 osób.",
		"Premie 20-300 zł miesięcznie.",
		"Kierownik projektu 2019-2023.",
		"Pracowałam w Warszawie i Krakowie, potem w Gdańsku.",
		"Firma.pl. W 2019 roku otworzyłam biuro.",
		"Sklep Firma.pl. 5 lat sprzedaży.",
		"Plac budowy przy 3 obiektach.",
		"Remonty na ulicach Warszawy w 2019-2023.",
		"Roboty na alejach Krakowa w 2020 roku.",
		"Budżety 10-200 PLN i 20-300 EUR.",
		"Premie 20-300 ZŁ.",
		"Premie 20-300 NOK miesięcznie.",
		"Zespół 10-200 OSÓB.",
	])("keeps professional facts unchanged: %j", (input) => {
		expect(redactTextForAi(input, patternsOnly)).toBe(input);
	});

	it.each([
		// A postal code before a town written in capitals cannot be told apart from an upper-case unit.
		["Kod 00-950 WARSZAWA", "Kod 00-950 WARSZAWA"],
		// A number inside the street name leaves the flat number behind, without the street.
		["ul. Dywizjonu 303 12 m. 4", "[ADRES] 12 m. 4"],
	])("documents a known limitation: %j", (input, expected) => {
		expect(redactTextForAi(input, patternsOnly)).toBe(expected);
	});
});

describe("redactTextForAi: identity values", () => {
	it("redacts the full name in either order, case-insensitively, with and without Polish characters", () => {
		expect(redactTextForAi("Prepared by Anna Zielińska.", context)).toBe("Prepared by [OSOBA].");
		expect(redactTextForAi("ZIELIŃSKA ANNA signed it", context)).toBe("[OSOBA] signed it");
		expect(redactTextForAi("anna   zielinska", context)).toBe("[OSOBA]");
	});

	it("redacts the last name alone as a whole word only", () => {
		expect(redactTextForAi("Report by Zielińska", context)).toBe("Report by [OSOBA]");
		expect(redactTextForAi("Report by zielinska", context)).toBe("Report by [OSOBA]");
		expect(redactTextForAi("Zielińskakowska and Zielińskiego stay", context)).toBe(
			"Zielińskakowska and Zielińskiego stay",
		);
	});

	it("does not redact the first name alone", () => {
		expect(redactTextForAi("Worked with Anna from the finance team.", context)).toBe(
			"Worked with Anna from the finance team.",
		);
	});

	it("ignores last names shorter than three characters", () => {
		const shortName = buildAiRedactionContext([{ firstName: "Jan", lastName: "Li" }]);

		expect(redactTextForAi("Li-ion batteries by Jan Li", shortName)).toBe("Li-ion batteries by [OSOBA]");
	});

	it("redacts parts of a compound last name", () => {
		const compound = buildAiRedactionContext([{ firstName: "Ewa", lastName: "Nowak-Kowalska" }]);

		expect(redactTextForAi("Ewa Nowak-Kowalska, Kowalska and Nowak", compound)).toBe("[OSOBA], [OSOBA] and [OSOBA]");
	});

	it("redacts the identity e-mail, phone written differently, LinkedIn and website", () => {
		expect(redactTextForAi("Write to ANNA.ZIELINSKA@EXAMPLE.TEST", context)).toBe("Write to [EMAIL]");
		expect(redactTextForAi("Phone 601234567 or 601.234.567", context)).toBe("Phone [TELEFON] or [TELEFON]");
		expect(redactTextForAi("linkedin.com/in/anna-zielinska and annazielinska.pl", context)).toBe("[URL] and [URL]");
	});

	it("merges identity values from several sources", () => {
		const merged = buildAiRedactionContext([
			{ firstName: "Anna", lastName: "Zielińska" },
			{ firstName: "Anna", lastName: "Nowak", email: "anna@nowa.test" },
			null,
		]);

		expect(redactTextForAi("Zielińska, Nowak, anna@nowa.test", merged)).toBe("[OSOBA], [OSOBA], [EMAIL]");
	});

	it("redacts a longer full name from one source before a bare last name from another", () => {
		const merged = buildAiRedactionContext([
			{ firstName: "Jan", lastName: "Kowalski" },
			{ firstName: "Jan Maria", lastName: "Kowalski" },
		]);

		expect(redactTextForAi("Jan Maria Kowalski", merged)).toBe("[OSOBA]");
	});

	it.each([
		"Project manager 2019-2023 and coordinator 2019–2023.",
		"Budget of 125 000 000 PLN and 500 000 000 zł.",
		"Revenue 601 234 567 PLN.",
		"Revenue 601 234 567 zł.",
		"Revenue 601234567 PLN.",
		"Worked for Booking.com and Allegro.pl in Wrocław.",
		"Built services in ASP.NET/MVC and Node.js.",
		"Worked with Anna from the finance team.",
	])("keeps professional facts unchanged with a full identity: %j", (input) => {
		expect(redactTextForAi(input, context)).toBe(input);
	});

	it("redacts a company name equal to the candidate's last name (accepted trade-off)", () => {
		// Known, accepted limitation of P0 #15: identity terms win over professional facts in the AI
		// payload. The stored CV keeps the original text, because a rewrite that drops the fact falls
		// back to the user's own source text.
		const ford = buildAiRedactionContext([{ firstName: "Jan", lastName: "Ford" }]);

		expect(redactTextForAi("Worked for Ford Motor Company in 2019-2023.", ford)).toBe(
			"Worked for [OSOBA] Motor Company in 2019-2023.",
		);
	});

	it("still redacts the identity phone with a label", () => {
		expect(redactTextForAi("tel. 601 234 567", context)).toBe("tel. [TELEFON]");
		expect(redactTextForAi("kom. +48 601-234-567, biuro", context)).toBe("kom. [TELEFON], biuro");
	});

	it("keeps location and other professional facts", () => {
		const withLocation = buildAiRedactionContext([{ ...identity, location: "Wrocław" } as never]);

		expect(redactTextForAi("Office in Wrocław, 483 offers in 2019–2023.", withLocation)).toBe(
			"Office in Wrocław, 483 offers in 2019–2023.",
		);
	});
});

describe("normalizeTextForAi", () => {
	it("folds compatibility forms such as a fullwidth at sign and ligatures", () => {
		expect(normalizeTextForAi("jan＠firma.pl, ﬁnanse")).toBe("jan@firma.pl, finanse");
	});

	it("drops soft hyphens and zero-width characters left by PDF extraction", () => {
		expect(normalizeTextForAi("jan.kowa­lski@fir​ma.pl﻿")).toBe("jan.kowalski@firma.pl");
	});

	it("removes stray spaces around line breaks and collapses horizontal whitespace", () => {
		expect(normalizeTextForAi("+48 600 \n 100 200\r\nWarszawa\t  Polska")).toBe("+48 600\n100 200\nWarszawa Polska");
	});
});

describe("redactTextForAi: PDF extraction artefacts", () => {
	it.each([
		["Kontakt: jan.kowalski@ gmail.com", "Kontakt: [EMAIL]"],
		["Kontakt: jan.kowalski @ gmail . com", "Kontakt: [EMAIL]"],
		["Kontakt: jan.kowalski@gmail.\ncom", "Kontakt: [EMAIL]"],
	])("redacts %j", (input, expected) => {
		expect(redactTextForAi(normalizeTextForAi(input), patternsOnly)).toBe(expected);
	});

	it("keeps the next sentence after an address that ends a sentence", () => {
		expect(redactTextForAi("Pisz na jan@firma.pl. Dalej opis projektu.", patternsOnly)).toBe(
			"Pisz na [EMAIL]. Dalej opis projektu.",
		);
		expect(redactTextForAi("Pisz na jan@firma.pl. ZESPÓŁ IT", patternsOnly)).toBe("Pisz na [EMAIL]. ZESPÓŁ IT");
	});

	it.each([
		["Kontakt: jan@ gmail . COM", "Kontakt: [EMAIL]"],
		["Kontakt: JAN @ GMAIL . PL", "Kontakt: [EMAIL]"],
		["Kontakt: jan@Gmail .com", "Kontakt: [EMAIL]"],
	])("redacts a spaced address with an upper-case domain: %j", (input, expected) => {
		expect(redactTextForAi(normalizeTextForAi(input), patternsOnly)).toBe(expected);
	});

	// Callsites that redact CV facts keep these exactly as at 62eb05b: the shapes are only phones in
	// contact lines (see redactContactLinePhones).
	it.each([
		"Numer zamówienia 600 10 20 30 zrealizowany w 2021.",
		"Sprzedaż wzrosła o 601 23 45 67 sztuk.",
		"Obsłużyłem zamówienie 600100200 w SAP.",
		"Budżet 500 10 20 30 zł w 2021.",
	])("keeps 3-2-2-2 and bare nine-digit numbers in free text: %j", (input) => {
		expect(redactTextForAi(input, patternsOnly)).toBe(input);
	});

	it("redacts a letter-spaced name heading from the identity", () => {
		const jan = buildAiRedactionContext([{ firstName: "Jan", lastName: "Kowalski" }]);

		expect(redactTextForAi(normalizeTextForAi("J A N   K O W A L S K I\nSpecjalista"), jan)).toBe(
			"[OSOBA]\nSpecjalista",
		);
		expect(redactTextForAi("K o w a l s k i", jan)).toBe("[OSOBA]");
	});

	it("does not spell out short last names letter by letter", () => {
		const short = buildAiRedactionContext([{ firstName: "Jan", lastName: "Iwa" }]);

		expect(redactTextForAi("a i w a", short)).toBe("a i w a");
	});

	it("redacts the whole path of the identity website", () => {
		expect(redactTextForAi("Portfolio: annazielinska.pl/portfolio/2023, more", context)).toBe("Portfolio: [URL], more");
	});
});

describe("redactContactLinePhones", () => {
	it.each([
		["600100200", "[TELEFON]"],
		["Kontakt: 600100200, Kraków", "Kontakt: [TELEFON], Kraków"],
		["+48600100200", "[TELEFON]"],
		["+48 600100200", "[TELEFON]"],
		["0048600100200", "[TELEFON]"],
		["Kom. 601 23 45 67 lub 601-23-45-67", "Kom. [TELEFON] lub [TELEFON]"],
	])("redacts %j", (input, expected) => {
		expect(redactContactLinePhones(input)).toBe(expected);
	});

	it.each([
		"NIP 5250000000",
		"REGON 012345678",
		"REGON: 012345678",
		"KRS 000012345",
		"PESEL 90010112345",
		"nr 600100200",
		"125000000 zł",
		"600100200 PLN",
		"2019–2023",
		"Budżet 500 10 20 30 zł",
		"6001002001",
	])("keeps %j", (input) => {
		expect(redactContactLinePhones(input)).toBe(input);
	});
});

describe("adversarial input performance", () => {
	// Generous threshold so the test stays stable on slow machines; the quadratic versions took seconds.
	const LIMIT_MS = 500;
	const ADVERSARIAL_INPUTS: Record<string, string> = {
		"local part without @": `${"a".repeat(49_999)}!`,
		"dotted labels": "a.".repeat(25_000),
		"dashed digits": "1-".repeat(25_000),
		"spaced at signs": "a @ ".repeat(12_500),
		"spaced dots": "a@a .".repeat(10_000),
	};

	function elapsed(run: () => unknown): number {
		const started = performance.now();
		run();
		return performance.now() - started;
	}

	it.each(Object.entries(ADVERSARIAL_INPUTS))("keeps both e-mail patterns linear on %s", (_label, input) => {
		expect(elapsed(() => input.replace(new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags), "x"))).toBeLessThan(
			LIMIT_MS,
		);
		expect(
			elapsed(() => input.replace(new RegExp(SPACED_EMAIL_PATTERN.source, SPACED_EMAIL_PATTERN.flags), "x")),
		).toBeLessThan(LIMIT_MS);
	});

	it.each(Object.entries(ADVERSARIAL_INPUTS))("keeps the whole redaction fast on %s", (_label, input) => {
		expect(elapsed(() => redactTextForAi(normalizeTextForAi(input), context))).toBeLessThan(LIMIT_MS);
	});
});

describe("redactValuesForAi", () => {
	it("redacts nested strings and keeps other values", () => {
		expect(
			redactValuesForAi(
				{
					text: "Contact anna.zielinska@example.test",
					isCurrent: true,
					count: 483,
					nested: [{ description: "Anna Zielińska, 601 234 567" }, null],
				},
				context,
			),
		).toEqual({
			text: "Contact [EMAIL]",
			isCurrent: true,
			count: 483,
			nested: [{ description: "[OSOBA], [TELEFON]" }, null],
		});
	});
});

describe("containsAiRedactionPlaceholder", () => {
	it.each([
		"[EMAIL]",
		"[TELEFON]",
		"[URL]",
		"[OSOBA]",
		"[ADRES]",
		"[ e-mail ]",
		"[PHONE]",
		"[Person]",
		"[name]",
		"[ address ]",
	])("detects %j", (placeholder) => {
		expect(containsAiRedactionPlaceholder(`Contact ${placeholder} today`)).toBe(true);
	});

	it("ignores ordinary text and missing values", () => {
		expect(containsAiRedactionPlaceholder("Coordinated [3] projects")).toBe(false);
		expect(containsAiRedactionPlaceholder(undefined)).toBe(false);
		expect(containsAiRedactionPlaceholder(null)).toBe(false);
	});
});
