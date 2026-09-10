import { crudRouter } from "./crud";
import { recommendationsRouter } from "./recommendations-route";

export const cvmateBuildRouter = {
	list: crudRouter.list,
	getById: crudRouter.getById,
	generateRecommendations: recommendationsRouter.generate,
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
	materialize: crudRouter.materialize,
};
