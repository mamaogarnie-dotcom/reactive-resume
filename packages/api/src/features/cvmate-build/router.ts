import { crudRouter } from "./crud";
import { documentsRouter } from "./documents-route";
import { recommendationsRouter } from "./recommendations-route";
import { tailoredContentRouter } from "./tailored-content-route";

export const cvmateBuildRouter = {
	list: crudRouter.list,
	getById: crudRouter.getById,
	generateRecommendations: recommendationsRouter.generate,
	generateTailoredContent: tailoredContentRouter.generate,
	create: crudRouter.create,
	update: crudRouter.update,
	delete: crudRouter.delete,
	listSelectionItems: crudRouter.listSelectionItems,
	createSelectionItem: crudRouter.createSelectionItem,
	updateSelectionItem: crudRouter.updateSelectionItem,
	deleteSelectionItem: crudRouter.deleteSelectionItem,
	listGaps: crudRouter.listGaps,
	createGap: crudRouter.createGap,
	updateGap: crudRouter.updateGap,
	deleteGap: crudRouter.deleteGap,
	listGeneratedContent: crudRouter.listGeneratedContent,
	updateGeneratedContentFinalText: crudRouter.updateGeneratedContentFinalText,
	listDocuments: documentsRouter.list,
	updateDocument: documentsRouter.update,
	materialize: crudRouter.materialize,
};
