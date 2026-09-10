import { analysisRouter } from "./analysis-route";
import { crudRouter } from "./crud";

export const cvmateJobOfferRouter = {
	list: crudRouter.list,
	getById: crudRouter.getById,
	analyze: analysisRouter.analyze,
	create: crudRouter.create,
	update: crudRouter.update,
	delete: crudRouter.delete,
	uploadAsset: crudRouter.uploadAsset,
	updateAsset: crudRouter.updateAsset,
	deleteAsset: crudRouter.deleteAsset,
	createRequirement: crudRouter.createRequirement,
	updateRequirement: crudRouter.updateRequirement,
	deleteRequirement: crudRouter.deleteRequirement,
};
