import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import udnsRouter from "./udns";
import profilesRouter from "./profiles";
import zonesRouter from "./zones";
import panelsRouter from "./panels";
import defectsRouter from "./defects";
import sidesRouter from "./sides";
import visualZonesRouter from "./visualZones";
import alphanumericRouter from "./alphanumeric";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(udnsRouter);
router.use(profilesRouter);
router.use(zonesRouter);
router.use(panelsRouter);
router.use(defectsRouter);
router.use(sidesRouter);
router.use(visualZonesRouter);
router.use(alphanumericRouter);
router.use(dashboardRouter);

export default router;
