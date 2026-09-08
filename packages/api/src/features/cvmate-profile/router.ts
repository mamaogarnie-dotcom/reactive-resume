import { crudRouter } from "./crud";

export const cvmateProfileRouter = {
getCurrent: crudRouter.getCurrent,
updateBasics: crudRouter.updateBasics,
createEmployment: crudRouter.createEmployment,
updateEmployment: crudRouter.updateEmployment,
deleteEmployment: crudRouter.deleteEmployment,
createExperienceFact: crudRouter.createExperienceFact,
updateExperienceFact: crudRouter.updateExperienceFact,
deleteExperienceFact: crudRouter.deleteExperienceFact,
linkEmploymentFact: crudRouter.linkEmploymentFact,
unlinkEmploymentFact: crudRouter.unlinkEmploymentFact,
createListItem: crudRouter.createListItem,
updateListItem: crudRouter.updateListItem,
deleteListItem: crudRouter.deleteListItem,
createProject: crudRouter.createProject,
updateProject: crudRouter.updateProject,
deleteProject: crudRouter.deleteProject,
};
