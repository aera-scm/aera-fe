/* Generated from aera-be services/shared/models.py by `make types`. Do not edit. */

/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CaseStatus".
 */
export type CaseStatus =
  | "RECEIVED"
  | "TRIAGED"
  | "INVESTIGATING"
  | "WAITING_PLANNER"
  | "WAITING_SUPPLIER"
  | "PLAN_PROPOSED"
  | "VERIFIED"
  | "AWAITING_APPROVAL"
  | "AUTO_APPROVED"
  | "APPROVED"
  | "REJECTED"
  | "ESCALATED"
  | "EXECUTING"
  | "MONITORING"
  | "REOPENED"
  | "CLOSED"
  | "ROLLED_BACK"
  | "FAILED_ROLLED_BACK";
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "SignalChannel".
 */
export type SignalChannel = "EMAIL" | "WHATSAPP" | "CARRIER" | "MANUAL" | "AGENT" | "LAB";
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "FieldStatus".
 */
export type FieldStatus = "CONFIRMED" | "UNCONFIRMED" | "SAP_MATCHED";
export type SignalStatus = "RECEIVED" | "ACCEPTED" | "QUARANTINED";
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "SignalStatus".
 */
export type SignalStatus1 = "RECEIVED" | "ACCEPTED" | "QUARANTINED";

export interface AeraContract {
  Approval?: Approval;
  ApproverLimit?: ApproverLimit;
  AuditEvent?: AuditEvent;
  Case?: Case;
  CaseDetail?: CaseDetail;
  CheckResult?: CheckResult;
  ConfigItem?: ConfigItem;
  DialogueMessage?: DialogueMessage;
  EventEnvelope?: EventEnvelope;
  ExecutionRecord?: ExecutionRecord;
  ExtractedField?: ExtractedField;
  Figure?: Figure;
  PlanRecord?: PlanRecord;
  Portfolio?: Portfolio;
  ProposedPlan?: ProposedPlan;
  RateCard?: RateCard;
  Reservation?: Reservation;
  ScenarioRun?: ScenarioRun;
  Signal?: Signal;
  SupplierReliability?: SupplierReliability;
  TraceEvent?: TraceEvent;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Approval".
 */
export interface Approval {
  approverId: string;
  backupApproverId?: string | null;
  caseId: string;
  comment?: string | null;
  deadlineAt: string;
  decidedAt?: string | null;
  decision?: ("APPROVED" | "REJECTED") | null;
  limitUsd: number;
  planPartId: string;
  planVersionHash: string;
  remindedAt?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ApproverLimit".
 */
export interface ApproverLimit {
  grantedBy?: string | null;
  limitUsd: number;
  plant: string;
  role: "approver";
  userId: string;
  validFrom: string;
  validTo: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "AuditEvent".
 */
export interface AuditEvent {
  actor: string;
  caseId?: string | null;
  chainKey: string;
  eventId: string;
  hash: string;
  payload: {
    [k: string]: unknown;
  };
  prevHash: string;
  ts: string;
  type: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Case".
 */
export interface Case {
  activeRunId?: string | null;
  caseId: string;
  confidence?: number | null;
  createdAt: string;
  daysLate?: number | null;
  figures?: Figure[];
  material: string;
  materialDescription?: string | null;
  planVersion?: number;
  plant: string;
  poItem?: string | null;
  poNumber?: string | null;
  priorityScore?: number | null;
  rarUsd?: number | null;
  signalIds?: string[];
  stage: "SIGNAL" | "TRIAGE" | "IMPACT" | "OPTIONS" | "APPROVE" | "EXECUTE";
  status: CaseStatus;
  stockoutAt?: string | null;
  tier?: (1 | 2 | 3) | null;
  type: "MRP_EXCEPTION" | "SUPPLIER_DELAY" | "CARRIER_DELAY" | "QUANTITY_SHORTFALL" | "OTHER";
  updatedAt: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Figure".
 */
export interface Figure {
  name: string;
  readAt?: string | null;
  sourceRef: string;
  unit?: string | null;
  value: number | string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CaseDetail".
 */
export interface CaseDetail {
  case: Case;
  execution?: ExecutionView[];
  plan?: PlanView | null;
  route?: RouteView | null;
  signals: Signal[];
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ExecutionView".
 */
export interface ExecutionView {
  milestones?: ExecutionMilestone[];
  planPartId: string;
  status: "READY" | "PENDING" | "SUCCEEDED" | "REJECTED" | "UNDONE";
  steps?: ExecutionStepView[];
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ExecutionMilestone".
 */
export interface ExecutionMilestone {
  ts: string;
  type: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ExecutionStepView".
 */
export interface ExecutionStepView {
  actionType: string;
  index: number;
  irreversible?: boolean;
  sapDocument?: string | null;
  sourceRef?: string | null;
  status?: ("READY" | "PENDING" | "SUCCEEDED" | "REJECTED" | "UNDONE") | null;
  target: string;
  undoType?: string | null;
}
/**
 * The current plan version with what the Verifier recorded and the hash to approve.
 *
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "PlanView".
 */
export interface PlanView {
  automatedReasoning?: AutomatedReasoningView | null;
  checks?: CheckResult[];
  confidence?: number | null;
  plan: ProposedPlan;
  planVersionHash?: string | null;
  proposedAt: string;
  verifiedAt?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "AutomatedReasoningView".
 */
export interface AutomatedReasoningView {
  findings?: string[];
  status: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CheckResult".
 */
export interface CheckResult {
  blocking: boolean;
  checkId: string;
  detail: string;
  optionId?: string | null;
  passed: boolean;
}
/**
 * What the agent may propose; no confidence and no checks (BR-18, 6.5).
 *
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ProposedPlan".
 */
export interface ProposedPlan {
  caseId: string;
  /**
   * @minItems 1
   */
  chosen: [string, ...string[]];
  coverageUnits: number;
  /**
   * @minItems 1
   */
  options: [Option, ...Option[]];
  planVersion: number;
  rationale: string;
  totalCostUsd: number;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Option".
 */
export interface Option {
  /**
   * @minItems 1
   */
  actions: [
    CreateSto | ChangePoDate | SplitPoScheduleLine | BookAirFreight | CreatePoAlternate,
    ...(CreateSto | ChangePoDate | SplitPoScheduleLine | BookAirFreight | CreatePoAlternate)[]
  ];
  arrival: string;
  costSourceRef: string;
  costUsd: number;
  coverageUnits: number;
  figures?: Figure[];
  id: string;
  name: string;
  rationale: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CreateSto".
 */
export interface CreateSto {
  deliveryDate: string;
  fromPlant: string;
  material: string;
  qty: number;
  toPlant: string;
  type: "CREATE_STO";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ChangePoDate".
 */
export interface ChangePoDate {
  newDate: string;
  poItem: string;
  poNumber: string;
  scheduleLine: string;
  type: "CHANGE_PO_DATE";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "SplitPoScheduleLine".
 */
export interface SplitPoScheduleLine {
  /**
   * @minItems 2
   */
  parts: [Part, Part, ...Part[]];
  poItem: string;
  poNumber: string;
  scheduleLine: string;
  type: "SPLIT_PO_SCHEDULE_LINE";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Part".
 */
export interface Part {
  deliveryDate: string;
  qty: number;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "BookAirFreight".
 */
export interface BookAirFreight {
  arrival: string;
  poItem: string;
  poNumber: string;
  qty: number;
  supplierId: string;
  type: "BOOK_AIR_FREIGHT";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CreatePoAlternate".
 */
export interface CreatePoAlternate {
  deliveryDate: string;
  material: string;
  plant: string;
  qty: number;
  supplierId: string;
  type: "CREATE_PO_ALTERNATE";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "RouteView".
 */
export interface RouteView {
  parts?: PlanPartView[];
  planVersion: number;
  planVersionHash: string;
  reason?: string | null;
  routedAt: string;
  tier: number;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "PlanPartView".
 */
export interface PlanPartView {
  approverId?: string | null;
  backupApproverId?: string | null;
  comment?: string | null;
  confidence?: number | null;
  costUsd: number;
  deadlineAt?: string | null;
  decidedAt?: string | null;
  decision?: ("APPROVED" | "REJECTED") | null;
  expired?: boolean;
  options: string[];
  planPartId: string;
  reminded?: boolean;
  reminderAt?: string | null;
  sampled?: boolean;
  tier: number;
  undoSummary?: UndoStep[];
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "UndoStep".
 */
export interface UndoStep {
  actionType: string;
  optionId: string;
  reversible: boolean;
  undo: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Signal".
 */
export interface Signal {
  attachments?: string[];
  caseId?: string | null;
  channel: SignalChannel;
  fields?: ExtractedField[];
  guardrailResult?: "NOT_SCANNED" | "PASSED" | "BLOCKED";
  language?: string | null;
  material?: string | null;
  normalizedText?: string | null;
  poNumber?: string | null;
  quarantineReason?: string | null;
  rawS3Key: string;
  rawSha256: string;
  receivedAt: string;
  senderId: string;
  senderVerified?: boolean;
  signalId: string;
  status?: SignalStatus;
  supplierId?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ExtractedField".
 */
export interface ExtractedField {
  confidence: number;
  confirmedBy?: string | null;
  fieldId: string;
  name:
    | ("PO_NUMBER" | "MATERIAL" | "QUANTITY" | "DELIVERY_DATE" | "PRICE")
    | ("TRACKING_NUMBER" | "CARRIER_STATUS" | "ETA" | "PO_ITEM");
  signalId: string;
  status: FieldStatus;
  value: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ConfigItem".
 */
export interface ConfigItem {
  changedAt: string;
  changedBy: string;
  key: string;
  value: number | string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "DialogueMessage".
 */
export interface DialogueMessage {
  caseId: string;
  direction: "OUTBOUND" | "INBOUND";
  englishCopy: string;
  language: string;
  messageId: string;
  referenceToken: string;
  renderedText: string;
  replySignalId?: string | null;
  sentAt?: string | null;
  status: "DRAFT" | "SENT" | "REPLIED" | "TIMED_OUT" | "BLOCKED";
  supplierId: string;
  templateId?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "EventEnvelope".
 */
export interface EventEnvelope {
  actor: string;
  caseId?: string | null;
  data: {
    [k: string]: unknown;
  };
  env: string;
  id?: string;
  runId?: string | null;
  time: string;
  traceId?: string | null;
  type:
    | "SignalReceived"
    | "SignalAccepted"
    | "SignalQuarantined"
    | "SignalExtracted"
    | "MrpExceptionsPolled"
    | "CaseOpened"
    | "CaseUpdated"
    | "CaseReadyForRun"
    | "RunStarted"
    | "RunEnded"
    | "PlanProposed"
    | "PlanVerified"
    | "PlanRouted"
    | "PlanApproved"
    | "PlanRejected"
    | "ExecutionStarted"
    | "ExecutionCompleted"
    | "ExecutionFailed"
    | "NotificationRequested"
    | "SupplierInfoRequested"
    | "SupplierReplyMatched"
    | "GoodsReceiptDue"
    | "CaseClosed"
    | "CaseReopened"
    | "PortfolioSolved"
    | "LabScenarioCreated";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ExecutionRecord".
 */
export interface ExecutionRecord {
  action: string;
  idempotencyKey: string;
  request: {
    [k: string]: unknown;
  };
  response?: {
    [k: string]: unknown;
  } | null;
  sapDocNumber?: string | null;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "UNDONE";
  undoAction?: {
    [k: string]: unknown;
  } | null;
}
/**
 * A stored plan: the proposal plus what the Verifier computed.
 *
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "PlanRecord".
 */
export interface PlanRecord {
  checks?: CheckResult[];
  confidence?: number | null;
  plan: ProposedPlan;
  proposedAt: string;
  verifiedAt?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Portfolio".
 */
export interface Portfolio {
  candidateActions: {
    [k: string]: unknown;
  }[];
  caseIds: string[];
  objective: number;
  portfolioId: string;
  savingVsSingle: number;
  solverStatus: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "TIMEOUT";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "RateCard".
 */
export interface RateCard {
  actionType: "STO" | "AIR_FREIGHT" | "ALTERNATE_SUPPLIER" | "EXPEDITE";
  changedBy?: string | null;
  entryId: string;
  fixedCostUsd: number;
  fromPlant?: string | null;
  lane?: string | null;
  leadTimeHours: number;
  supplierId?: string | null;
  toPlant?: string | null;
  unitCostUsd: number;
  validFrom: string;
  validTo: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Reservation".
 */
export interface Reservation {
  caseId: string;
  materialPlant: string;
  qty: number;
  reservationId: string;
  status: "HELD" | "COMMITTED" | "RELEASED";
  version?: number;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ScenarioRun".
 */
export interface ScenarioRun {
  createdBy: string;
  outcome?: string | null;
  parameters: {
    [k: string]: unknown;
  };
  scenarioId: string;
  synthetic?: true;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "SupplierReliability".
 */
export interface SupplierReliability {
  computedAt: string;
  material: string;
  meanDelayDays: number;
  onTimeRate: number;
  p90DelayDays: number;
  partialRate: number;
  sampleSize: number;
  supplierId: string;
  windowDays: number;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "TraceEvent".
 */
export interface TraceEvent {
  caseId: string;
  data?: {
    [k: string]: unknown;
  };
  detail?: string | null;
  eventId?: string;
  kind: "AGENT" | "TOOL_CALL" | "TOOL_RESULT" | "CHECK" | "GUARD" | "SYSTEM";
  runId?: string | null;
  ts: string;
}
