import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
select: vi.fn(),
insert: vi.fn(),
update: vi.fn(),
delete: vi.fn(),
transaction: vi.fn(),
}));

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

const { cvmateProfileService } = await import("./service");

const profile = {
id: "profile-1",
userId: "user-1",
firstName: null,
lastName: null,
email: null,
phone: null,
location: null,
linkedinUrl: null,
websiteUrl: null,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const employment = {
id: "employment-1",
masterProfileId: "profile-1",
company: "Acme",
jobTitle: null,
location: null,
startDate: null,
endDate: null,
isCurrent: false,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const project = {
id: "project-1",
masterProfileId: "profile-1",
name: "CVMate",
company: null,
startDate: null,
endDate: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const education = {
id: "education-1",
masterProfileId: "profile-1",
institution: "University of Wroclaw",
fieldOfStudy: null,
specialization: null,
degree: null,
startDate: null,
endDate: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const course = {
id: "course-1",
masterProfileId: "profile-1",
name: "AI Fundamentals",
organizer: null,
date: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const certification = {
id: "certification-1",
masterProfileId: "profile-1",
name: "Certified AI Specialist",
issuingOrganization: null,
issueDate: null,
expiryDate: null,
credentialNumber: null,
credentialUrl: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const volunteer = {
id: "volunteer-1",
masterProfileId: "profile-1",
organization: "Green Foundation",
role: null,
date: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const language = {
id: "language-1",
masterProfileId: "profile-1",
language: "English",
level: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const createSelectChain = (rows: unknown[]) => ({
from: () => ({
where: () => Promise.resolve(rows),
}),
});

const setSelectResults = (...results: unknown[][]) => {
dbMock.select.mockReset();

for (const rows of results) {
dbMock.select.mockReturnValueOnce(createSelectChain(rows));
}

dbMock.select.mockReturnValue(createSelectChain([]));
};

const mockUpdateReturning = (rows: unknown[]) => {
const returning = vi.fn(() => Promise.resolve(rows));
const where = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));

dbMock.update.mockReturnValue({ set });

return { set, where, returning };
};

const mockDeleteReturning = (rows: unknown[]) => {
const returning = vi.fn(() => Promise.resolve(rows));
const where = vi.fn(() => ({ returning }));

dbMock.delete.mockReturnValue({ where });

return { where, returning };
};

beforeEach(() => {
dbMock.select.mockReset();
dbMock.insert.mockReset();
dbMock.update.mockReset();
dbMock.delete.mockReset();
dbMock.transaction.mockReset();
dbMock.transaction.mockImplementation((callback) => callback(dbMock));

setSelectResults([]);
});

describe("cvmateProfileService.getCurrent", () => {
it("returns null and does not create a profile when none exists", async () => {
const result = await cvmateProfileService.getCurrent({ userId: "user-1" });

expect(result).toBeNull();
expect(dbMock.insert).not.toHaveBeenCalled();
expect(dbMock.transaction).not.toHaveBeenCalled();
});
});

describe("cvmateProfileService.updateBasics", () => {
it("creates the master profile and default sections on the first write", async () => {
setSelectResults([]);

const profileReturning = vi.fn(() => Promise.resolve([{ ...profile }]));
const profileOnConflict = vi.fn(() => ({ returning: profileReturning }));
const profileValues = vi.fn(() => ({ onConflictDoNothing: profileOnConflict }));

const sectionOnConflict = vi.fn(() => Promise.resolve());
const sectionValues = vi.fn(() => ({ onConflictDoNothing: sectionOnConflict }));

dbMock.insert
.mockReturnValueOnce({ values: profileValues })
.mockReturnValueOnce({ values: sectionValues });

const updatedProfile = {
...profile,
firstName: "Aga",
updatedAt: new Date("2026-09-08T10:05:00.000Z"),
};

mockUpdateReturning([updatedProfile]);

const result = await cvmateProfileService.updateBasics({
userId: "user-1",
firstName: "Aga",
});

expect(dbMock.transaction).toHaveBeenCalledTimes(1);
expect(profileValues).toHaveBeenCalledTimes(1);
expect(sectionValues).toHaveBeenCalledTimes(1);

const [sections] = sectionValues.mock.calls[0] as unknown as [
{
kind: string;
title: string;
isVisible: boolean;
sortOrder: number;
}[],
];

expect(sections).toHaveLength(17);
expect(sections.map((section) => section.kind)).toEqual([
"basics",
"experience",
"skills",
"education",
"languages",
"clauses",
"projects",
"courses",
"certifications",
"volunteer",
"software",
"tools",
"awards",
"references",
"interests",
"licenses",
"photos",
]);
expect(sections.every((section) => section.title === "")).toBe(true);
expect(sections.every((section) => section.isVisible)).toBe(true);

expect(result).not.toHaveProperty("userId");
expect(result.firstName).toBe("Aga");
});

it("reuses the profile created by a concurrent request", async () => {
setSelectResults([], [{ ...profile }]);

const profileReturning = vi.fn(() => Promise.resolve([]));
const profileOnConflict = vi.fn(() => ({ returning: profileReturning }));
const profileValues = vi.fn(() => ({ onConflictDoNothing: profileOnConflict }));

dbMock.insert.mockReturnValueOnce({ values: profileValues });

const updatedProfile = {
...profile,
location: "Wroclaw",
};

mockUpdateReturning([updatedProfile]);

const result = await cvmateProfileService.updateBasics({
userId: "user-1",
location: "Wroclaw",
});

expect(dbMock.insert).toHaveBeenCalledTimes(1);
expect(result.location).toBe("Wroclaw");
});
});

describe("cvmateProfileService.updateEmployment", () => {
it("rejects an update that would leave an entirely empty employment record", async () => {
setSelectResults([{ ...profile }], [{ ...employment }]);

await expect(
cvmateProfileService.updateEmployment({
id: "employment-1",
userId: "user-1",
company: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the employment is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateEmployment({
id: "employment-other-user",
userId: "user-1",
jobTitle: "Manager",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned employment when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...employment }]);

const updatedEmployment = {
...employment,
jobTitle: "Manager",
};

const { set } = mockUpdateReturning([updatedEmployment]);

const result = await cvmateProfileService.updateEmployment({
id: "employment-1",
userId: "user-1",
jobTitle: "Manager",
});

expect(set).toHaveBeenCalledWith({ jobTitle: "Manager" });
expect(result.jobTitle).toBe("Manager");
});
});

describe("cvmateProfileService employment facts", () => {
it("does not link a fact when either record is outside the current profile", async () => {
setSelectResults([{ ...profile }], [{ id: "employment-1" }], []);

await expect(
cvmateProfileService.linkEmploymentFact({
userId: "user-1",
employmentId: "employment-1",
experienceFactId: "fact-other-user",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.insert).not.toHaveBeenCalled();
});
});

describe("cvmateProfileService projects", () => {
it("creates a project inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdProject = {
...project,
description: "Commercial CV builder",
};

const returning = vi.fn(() => Promise.resolve([createdProject]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createProject({
userId: "user-1",
name: "CVMate",
description: "Commercial CV builder",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
name: "CVMate",
description: "Commercial CV builder",
}),
);
expect(result).toEqual(createdProject);
});

it("rejects an update that would leave an entirely empty project", async () => {
setSelectResults([{ ...profile }], [{ ...project }]);

await expect(
cvmateProfileService.updateProject({
id: "project-1",
userId: "user-1",
name: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the project is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateProject({
id: "project-other-user",
userId: "user-1",
description: "Changed",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned project when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...project }]);

const updatedProject = {
...project,
description: "Updated project description",
};

const { set } = mockUpdateReturning([updatedProject]);

const result = await cvmateProfileService.updateProject({
id: "project-1",
userId: "user-1",
description: "Updated project description",
});

expect(set).toHaveBeenCalledWith({
description: "Updated project description",
});
expect(result.description).toBe("Updated project description");
});

it("deletes only a project owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...project }]);

const { returning } = mockDeleteReturning([{ id: "project-1" }]);

await expect(
cvmateProfileService.deleteProject({
id: "project-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});

describe("cvmateProfileService education", () => {
it("creates an education record inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdEducation = {
...education,
fieldOfStudy: "Biology",
};

const returning = vi.fn(() => Promise.resolve([createdEducation]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createEducation({
userId: "user-1",
institution: "University of Wroclaw",
fieldOfStudy: "Biology",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
institution: "University of Wroclaw",
fieldOfStudy: "Biology",
}),
);
expect(result).toEqual(createdEducation);
});

it("rejects an update that would leave an entirely empty education record", async () => {
setSelectResults([{ ...profile }], [{ ...education }]);

await expect(
cvmateProfileService.updateEducation({
id: "education-1",
userId: "user-1",
institution: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the education record is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateEducation({
id: "education-other-user",
userId: "user-1",
degree: "Master",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned education record when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...education }]);

const updatedEducation = {
...education,
degree: "Master",
};

const { set } = mockUpdateReturning([updatedEducation]);

const result = await cvmateProfileService.updateEducation({
id: "education-1",
userId: "user-1",
degree: "Master",
});

expect(set).toHaveBeenCalledWith({
degree: "Master",
});
expect(result.degree).toBe("Master");
});

it("deletes only an education record owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...education }]);

const { returning } = mockDeleteReturning([{ id: "education-1" }]);

await expect(
cvmateProfileService.deleteEducation({
id: "education-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});

describe("cvmateProfileService courses", () => {
it("creates a course inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdCourse = {
...course,
organizer: "OpenAI Academy",
};

const returning = vi.fn(() => Promise.resolve([createdCourse]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createCourse({
userId: "user-1",
name: "AI Fundamentals",
organizer: "OpenAI Academy",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
name: "AI Fundamentals",
organizer: "OpenAI Academy",
}),
);
expect(result).toEqual(createdCourse);
});

it("rejects an update that would leave an entirely empty course", async () => {
setSelectResults([{ ...profile }], [{ ...course }]);

await expect(
cvmateProfileService.updateCourse({
id: "course-1",
userId: "user-1",
name: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the course is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateCourse({
id: "course-other-user",
userId: "user-1",
description: "Changed",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned course when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...course }]);

const updatedCourse = {
...course,
description: "Completed with certificate",
};

const { set } = mockUpdateReturning([updatedCourse]);

const result = await cvmateProfileService.updateCourse({
id: "course-1",
userId: "user-1",
description: "Completed with certificate",
});

expect(set).toHaveBeenCalledWith({
description: "Completed with certificate",
});
expect(result.description).toBe("Completed with certificate");
});

it("deletes only a course owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...course }]);

const { returning } = mockDeleteReturning([{ id: "course-1" }]);

await expect(
cvmateProfileService.deleteCourse({
id: "course-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});

describe("cvmateProfileService certifications", () => {
it("creates a certification inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdCertification = {
...certification,
issuingOrganization: "AI Institute",
};

const returning = vi.fn(() => Promise.resolve([createdCertification]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createCertification({
userId: "user-1",
name: "Certified AI Specialist",
issuingOrganization: "AI Institute",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
name: "Certified AI Specialist",
issuingOrganization: "AI Institute",
}),
);
expect(result).toEqual(createdCertification);
});

it("rejects an update that would leave an entirely empty certification", async () => {
setSelectResults([{ ...profile }], [{ ...certification }]);

await expect(
cvmateProfileService.updateCertification({
id: "certification-1",
userId: "user-1",
name: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the certification is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateCertification({
id: "certification-other-user",
userId: "user-1",
credentialNumber: "CERT-123",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned certification when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...certification }]);

const updatedCertification = {
...certification,
credentialNumber: "CERT-123",
};

const { set } = mockUpdateReturning([updatedCertification]);

const result = await cvmateProfileService.updateCertification({
id: "certification-1",
userId: "user-1",
credentialNumber: "CERT-123",
});

expect(set).toHaveBeenCalledWith({
credentialNumber: "CERT-123",
});
expect(result.credentialNumber).toBe("CERT-123");
});

it("deletes only a certification owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...certification }]);

const { returning } = mockDeleteReturning([{ id: "certification-1" }]);

await expect(
cvmateProfileService.deleteCertification({
id: "certification-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});

describe("cvmateProfileService volunteer", () => {
it("creates a volunteer record inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdVolunteer = {
...volunteer,
role: "Coordinator",
};

const returning = vi.fn(() => Promise.resolve([createdVolunteer]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createVolunteer({
userId: "user-1",
organization: "Green Foundation",
role: "Coordinator",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
organization: "Green Foundation",
role: "Coordinator",
}),
);
expect(result).toEqual(createdVolunteer);
});

it("rejects an update that would leave an entirely empty volunteer record", async () => {
setSelectResults([{ ...profile }], [{ ...volunteer }]);

await expect(
cvmateProfileService.updateVolunteer({
id: "volunteer-1",
userId: "user-1",
organization: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the volunteer record is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateVolunteer({
id: "volunteer-other-user",
userId: "user-1",
role: "Coordinator",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned volunteer record when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...volunteer }]);

const updatedVolunteer = {
...volunteer,
role: "Coordinator",
};

const { set } = mockUpdateReturning([updatedVolunteer]);

const result = await cvmateProfileService.updateVolunteer({
id: "volunteer-1",
userId: "user-1",
role: "Coordinator",
});

expect(set).toHaveBeenCalledWith({
role: "Coordinator",
});
expect(result.role).toBe("Coordinator");
});

it("deletes only a volunteer record owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...volunteer }]);

const { returning } = mockDeleteReturning([{ id: "volunteer-1" }]);

await expect(
cvmateProfileService.deleteVolunteer({
id: "volunteer-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});

describe("cvmateProfileService languages", () => {
it("creates a language record inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdLanguage = {
...language,
level: "C1",
};

const returning = vi.fn(() => Promise.resolve([createdLanguage]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createLanguage({
userId: "user-1",
language: "English",
level: "C1",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
language: "English",
level: "C1",
}),
);
expect(result).toEqual(createdLanguage);
});

it("rejects an update that would leave an entirely empty language record", async () => {
setSelectResults([{ ...profile }], [{ ...language }]);

await expect(
cvmateProfileService.updateLanguage({
id: "language-1",
userId: "user-1",
language: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the language record is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateLanguage({
id: "language-other-user",
userId: "user-1",
level: "B2",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned language record when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...language }]);

const updatedLanguage = {
...language,
level: "C1",
};

const { set } = mockUpdateReturning([updatedLanguage]);

const result = await cvmateProfileService.updateLanguage({
id: "language-1",
userId: "user-1",
level: "C1",
});

expect(set).toHaveBeenCalledWith({
level: "C1",
});
expect(result.level).toBe("C1");
});

it("deletes only a language record owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...language }]);

const { returning } = mockDeleteReturning([{ id: "language-1" }]);

await expect(
cvmateProfileService.deleteLanguage({
id: "language-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});
describe("cvmateProfileService awards", () => {
const award = {
id: "award-1",
masterProfileId: "profile-1",
name: "Best Project",
organizer: null,
date: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

it("creates an award inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdAward = {
...award,
organizer: "Industry Association",
};

const returning = vi.fn(() => Promise.resolve([createdAward]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createAward({
userId: "user-1",
name: "Best Project",
organizer: "Industry Association",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
name: "Best Project",
organizer: "Industry Association",
}),
);
expect(result).toEqual(createdAward);
});

it("rejects an update that would leave an entirely empty award", async () => {
setSelectResults([{ ...profile }], [{ ...award }]);

await expect(
cvmateProfileService.updateAward({
id: "award-1",
userId: "user-1",
name: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the award is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateAward({
id: "award-other-user",
userId: "user-1",
description: "Changed",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned award when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...award }]);

const updatedAward = {
...award,
description: "Awarded for innovation",
};

const { set } = mockUpdateReturning([updatedAward]);

const result = await cvmateProfileService.updateAward({
id: "award-1",
userId: "user-1",
description: "Awarded for innovation",
});

expect(set).toHaveBeenCalledWith({
description: "Awarded for innovation",
});
expect(result.description).toBe("Awarded for innovation");
});

it("deletes only an award owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...award }]);

const { returning } = mockDeleteReturning([{ id: "award-1" }]);

await expect(
cvmateProfileService.deleteAward({
id: "award-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});

describe("cvmateProfileService references", () => {
const reference = {
id: "reference-1",
masterProfileId: "profile-1",
name: "Professional Reference",
issuer: null,
date: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

it("creates a reference inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdReference = {
...reference,
issuer: "Former Employer",
};

const returning = vi.fn(() => Promise.resolve([createdReference]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createReference({
userId: "user-1",
name: "Professional Reference",
issuer: "Former Employer",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
name: "Professional Reference",
issuer: "Former Employer",
}),
);
expect(result).toEqual(createdReference);
});

it("rejects an update that would leave an entirely empty reference", async () => {
setSelectResults([{ ...profile }], [{ ...reference }]);

await expect(
cvmateProfileService.updateReference({
id: "reference-1",
userId: "user-1",
name: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the reference is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateReference({
id: "reference-other-user",
userId: "user-1",
description: "Changed",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned reference when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...reference }]);

const updatedReference = {
...reference,
description: "Strong professional recommendation",
};

const { set } = mockUpdateReturning([updatedReference]);

const result = await cvmateProfileService.updateReference({
id: "reference-1",
userId: "user-1",
description: "Strong professional recommendation",
});

expect(set).toHaveBeenCalledWith({
description: "Strong professional recommendation",
});
expect(result.description).toBe("Strong professional recommendation");
});

it("deletes only a reference owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...reference }]);

const { returning } = mockDeleteReturning([{ id: "reference-1" }]);

await expect(
cvmateProfileService.deleteReference({
id: "reference-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});

describe("cvmateProfileService licenses", () => {
const license = {
id: "license-1",
masterProfileId: "profile-1",
name: "Driving Licence B",
date: null,
description: null,
sortOrder: 0,
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

it("creates a license inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const createdLicense = {
...license,
description: "Category B",
};

const returning = vi.fn(() => Promise.resolve([createdLicense]));
const values = vi.fn(() => ({ returning }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.createLicense({
userId: "user-1",
name: "Driving Licence B",
description: "Category B",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
name: "Driving Licence B",
description: "Category B",
}),
);
expect(result).toEqual(createdLicense);
});

it("rejects an update that would leave an entirely empty license", async () => {
setSelectResults([{ ...profile }], [{ ...license }]);

await expect(
cvmateProfileService.updateLicense({
id: "license-1",
userId: "user-1",
name: null,
}),
).rejects.toMatchObject({
code: "BAD_REQUEST",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("returns NOT_FOUND when the license is outside the current user's profile", async () => {
setSelectResults([{ ...profile }], []);

await expect(
cvmateProfileService.updateLicense({
id: "license-other-user",
userId: "user-1",
description: "Changed",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});

expect(dbMock.update).not.toHaveBeenCalled();
});

it("updates an owned license when at least one business field remains", async () => {
setSelectResults([{ ...profile }], [{ ...license }]);

const updatedLicense = {
...license,
description: "Valid category B licence",
};

const { set } = mockUpdateReturning([updatedLicense]);

const result = await cvmateProfileService.updateLicense({
id: "license-1",
userId: "user-1",
description: "Valid category B licence",
});

expect(set).toHaveBeenCalledWith({
description: "Valid category B licence",
});
expect(result.description).toBe("Valid category B licence");
});

it("deletes only a license owned by the current user's profile", async () => {
setSelectResults([{ ...profile }], [{ ...license }]);

const { returning } = mockDeleteReturning([{ id: "license-1" }]);

await expect(
cvmateProfileService.deleteLicense({
id: "license-1",
userId: "user-1",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});
describe("cvmateProfileService clauses", () => {
const clause = {
id: "clause-1",
masterProfileId: "profile-1",
scope: "current" as const,
language: "pl" as const,
isEnabled: true,
content: "Wyrażam zgodę na przetwarzanie danych osobowych.",
createdAt: new Date("2026-09-08T10:00:00.000Z"),
updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

it("upserts a clause inside the current user's master profile", async () => {
setSelectResults([{ ...profile }]);

const returning = vi.fn(() => Promise.resolve([{ ...clause }]));
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.upsertClause({
userId: "user-1",
scope: "current",
language: "pl",
content: "Wyrażam zgodę na przetwarzanie danych osobowych.",
});

expect(values).toHaveBeenCalledWith(
expect.objectContaining({
masterProfileId: "profile-1",
scope: "current",
language: "pl",
content: "Wyrażam zgodę na przetwarzanie danych osobowych.",
}),
);

expect(onConflictDoUpdate).toHaveBeenCalledWith(
expect.objectContaining({
target: [
expect.anything(),
expect.anything(),
expect.anything(),
],
set: {
content: "Wyrażam zgodę na przetwarzanie danych osobowych.",
},
}),
);

expect(result).toEqual(clause);
});

it("updates only isEnabled when content is omitted", async () => {
setSelectResults([{ ...profile }]);

const disabledClause = {
...clause,
isEnabled: false,
};

const returning = vi.fn(() => Promise.resolve([disabledClause]));
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.upsertClause({
userId: "user-1",
scope: "current",
language: "pl",
isEnabled: false,
});

expect(onConflictDoUpdate).toHaveBeenCalledWith(
expect.objectContaining({
set: {
isEnabled: false,
},
}),
);

expect(result.isEnabled).toBe(false);
});

it("allows explicitly clearing clause content", async () => {
setSelectResults([{ ...profile }]);

const clearedClause = {
...clause,
content: null,
};

const returning = vi.fn(() => Promise.resolve([clearedClause]));
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate }));

dbMock.insert.mockReturnValue({ values });

const result = await cvmateProfileService.upsertClause({
userId: "user-1",
scope: "current",
language: "pl",
content: null,
});

expect(onConflictDoUpdate).toHaveBeenCalledWith(
expect.objectContaining({
set: {
content: null,
},
}),
);

expect(result.content).toBeNull();
});

it("returns NOT_FOUND when deleting a clause that does not exist", async () => {
setSelectResults([{ ...profile }]);

mockDeleteReturning([]);

await expect(
cvmateProfileService.deleteClause({
userId: "user-1",
scope: "current",
language: "pl",
}),
).rejects.toMatchObject({
code: "NOT_FOUND",
});
});

it("deletes a clause identified by scope and language", async () => {
setSelectResults([{ ...profile }]);

const { returning } = mockDeleteReturning([{ id: "clause-1" }]);

await expect(
cvmateProfileService.deleteClause({
userId: "user-1",
scope: "current",
language: "pl",
}),
).resolves.toBeUndefined();

expect(returning).toHaveBeenCalledTimes(1);
});
});
