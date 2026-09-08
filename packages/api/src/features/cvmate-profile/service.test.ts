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
