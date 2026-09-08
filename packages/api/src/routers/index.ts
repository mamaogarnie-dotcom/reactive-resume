import { agentRouter } from "../features/agent/router";
import { aiRouter } from "../features/ai/router";
import { aiProvidersRouter } from "../features/ai-providers/router";
import { applicationsRouter } from "../features/applications/router";
import { authRouter } from "../features/auth/router";
import { coverLettersRouter } from "../features/cover-letters/router";
import { cvmatePreferencesRouter } from "../features/cvmate-preferences/router";
import { cvmateProfileRouter } from "../features/cvmate-profile/router";
import { flagsRouter } from "../features/flags/router";
import { resumeRouter } from "../features/resume/router";
import { statisticsRouter } from "../features/statistics/router";
import { storageRouter } from "../features/storage/router";

export default {
ai: aiRouter,
aiProviders: aiProvidersRouter,
agent: agentRouter,
applications: applicationsRouter,
auth: authRouter,
coverLetters: coverLettersRouter,
cvmatePreferences: cvmatePreferencesRouter,
cvmateProfile: cvmateProfileRouter,
flags: flagsRouter,
resume: resumeRouter,
statistics: statisticsRouter,
storage: storageRouter,
};
