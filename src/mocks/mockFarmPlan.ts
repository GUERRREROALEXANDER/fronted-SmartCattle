// Demo farm drawing: the demo lots and cameras laid out on the shared farm layout.
import { buildFarmPlan, type FarmPlan } from '../services/farmLayout'
import { mockCameras, mockLots } from './mockData'

export type { FarmPlan } from '../services/farmLayout'

export const mockFarmPlan: FarmPlan = buildFarmPlan(mockLots, mockCameras)!
