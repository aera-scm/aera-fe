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
export type SignalStatus = "RECEIVED" | "ACCEPTED" | "QUARANTINED";
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "FieldStatus".
 */
export type FieldStatus = "CONFIRMED" | "UNCONFIRMED" | "SAP_MATCHED";
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "SignalStatus".
 */
export type SignalStatus1 = "RECEIVED" | "ACCEPTED" | "QUARANTINED";

export interface AeraContract {
  Case?: Case;
  Signal?: Signal;
  ExtractedField?: ExtractedField;
  Figure?: Figure;
  ProposedPlan?: ProposedPlan;
  PlanRecord?: PlanRecord;
  CheckResult?: CheckResult;
  Approval?: Approval;
  Reservation?: Reservation;
  ExecutionRecord?: ExecutionRecord;
  AuditEvent?: AuditEvent;
  ConfigItem?: ConfigItem;
  RateCard?: RateCard;
  ApproverLimit?: ApproverLimit;
  SupplierReliability?: SupplierReliability;
  DialogueMessage?: DialogueMessage;
  Portfolio?: Portfolio;
  ScenarioRun?: ScenarioRun;
  EventEnvelope?: EventEnvelope;
  TraceEvent?: TraceEvent;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Case".
 */
export interface Case {
  caseId: string;
  type: "MRP_EXCEPTION" | "SUPPLIER_DELAY" | "CARRIER_DELAY" | "QUANTITY_SHORTFALL" | "OTHER";
  material: string;
  materialDescription?: string | null;
  plant: string;
  poNumber?: string | null;
  poItem?: string | null;
  status: CaseStatus;
  tier?: (1 | 2 | 3) | null;
  priorityScore?: number | null;
  rarUsd?: number | null;
  stockoutAt?: string | null;
  daysLate?: number | null;
  confidence?: number | null;
  planVersion?: number;
  activeRunId?: string | null;
  signalIds?: string[];
  figures?: Figure[];
  createdAt: string;
  updatedAt: string;
  stage: "SIGNAL" | "TRIAGE" | "IMPACT" | "OPTIONS" | "APPROVE" | "EXECUTE";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Figure".
 */
export interface Figure {
  name: string;
  value: number | string;
  unit?: string | null;
  sourceRef: string;
  readAt?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Signal".
 */
export interface Signal {
  signalId: string;
  channel: SignalChannel;
  senderId: string;
  senderVerified?: boolean;
  supplierId?: string | null;
  receivedAt: string;
  rawS3Key: string;
  rawSha256: string;
  attachments?: string[];
  normalizedText?: string | null;
  guardrailResult?: "NOT_SCANNED" | "PASSED" | "BLOCKED";
  quarantineReason?: string | null;
  language?: string | null;
  poNumber?: string | null;
  material?: string | null;
  caseId?: string | null;
  status?: SignalStatus;
  fields?: ExtractedField[];
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ExtractedField".
 */
export interface ExtractedField {
  fieldId: string;
  signalId: string;
  name:
    | ("PO_NUMBER" | "MATERIAL" | "QUANTITY" | "DELIVERY_DATE" | "PRICE")
    | ("TRACKING_NUMBER" | "CARRIER_STATUS" | "ETA" | "PO_ITEM");
  value: string;
  confidence: number;
  status: FieldStatus;
  confirmedBy?: string | null;
}
/**
 * What the agent may propose; no confidence and no checks (BR-18, 6.5).
 *
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ProposedPlan".
 */
export interface ProposedPlan {
  caseId: string;
  planVersion: number;
  /**
   * @minItems 1
   */
  options: [Option, ...Option[]];
  /**
   * @minItems 1
   */
  chosen: [string, ...string[]];
  totalCostUsd: number;
  coverageUnits: number;
  rationale: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Option".
 */
export interface Option {
  id: string;
  name: string;
  /**
   * @minItems 1
   */
  actions: [
    CreateSto | ChangePoDate | SplitPoScheduleLine | BookAirFreight | CreatePoAlternate,
    ...(CreateSto | ChangePoDate | SplitPoScheduleLine | BookAirFreight | CreatePoAlternate)[]
  ];
  coverageUnits: number;
  arrival: string;
  costUsd: number;
  costSourceRef: string;
  figures?: Figure[];
  rationale: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CreateSto".
 */
export interface CreateSto {
  type: "CREATE_STO";
  fromPlant: string;
  toPlant: string;
  material: string;
  qty: number;
  deliveryDate: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ChangePoDate".
 */
export interface ChangePoDate {
  type: "CHANGE_PO_DATE";
  poNumber: string;
  poItem: string;
  scheduleLine: string;
  newDate: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "SplitPoScheduleLine".
 */
export interface SplitPoScheduleLine {
  type: "SPLIT_PO_SCHEDULE_LINE";
  poNumber: string;
  poItem: string;
  scheduleLine: string;
  /**
   * @minItems 2
   */
  parts: [Part, Part, ...Part[]];
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Part".
 */
export interface Part {
  qty: number;
  deliveryDate: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "BookAirFreight".
 */
export interface BookAirFreight {
  type: "BOOK_AIR_FREIGHT";
  supplierId: string;
  poNumber: string;
  poItem: string;
  qty: number;
  arrival: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CreatePoAlternate".
 */
export interface CreatePoAlternate {
  type: "CREATE_PO_ALTERNATE";
  supplierId: string;
  material: string;
  plant: string;
  qty: number;
  deliveryDate: string;
}
/**
 * A stored plan: the proposal plus what the Verifier computed.
 *
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "PlanRecord".
 */
export interface PlanRecord {
  plan: ProposedPlan;
  confidence?: number | null;
  checks?: CheckResult[];
  proposedAt: string;
  verifiedAt?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "CheckResult".
 */
export interface CheckResult {
  checkId: string;
  passed: boolean;
  blocking: boolean;
  optionId?: string | null;
  detail: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Approval".
 */
export interface Approval {
  caseId: string;
  planPartId: string;
  planVersionHash: string;
  approverId: string;
  backupApproverId?: string | null;
  limitUsd: number;
  deadlineAt: string;
  remindedAt?: string | null;
  decision?: ("APPROVED" | "REJECTED") | null;
  comment?: string | null;
  decidedAt?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Reservation".
 */
export interface Reservation {
  materialPlant: string;
  reservationId: string;
  caseId: string;
  qty: number;
  status: "HELD" | "COMMITTED" | "RELEASED";
  version?: number;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ExecutionRecord".
 */
export interface ExecutionRecord {
  idempotencyKey: string;
  action: string;
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
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "AuditEvent".
 */
export interface AuditEvent {
  eventId: string;
  chainKey: string;
  caseId?: string | null;
  ts: string;
  actor: string;
  type: string;
  payload: {
    [k: string]: unknown;
  };
  prevHash: string;
  hash: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ConfigItem".
 */
export interface ConfigItem {
  key: string;
  value: number | string;
  changedBy: string;
  changedAt: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "RateCard".
 */
export interface RateCard {
  entryId: string;
  actionType: "STO" | "AIR_FREIGHT" | "ALTERNATE_SUPPLIER" | "EXPEDITE";
  fromPlant?: string | null;
  toPlant?: string | null;
  supplierId?: string | null;
  lane?: string | null;
  unitCostUsd: number;
  fixedCostUsd: number;
  leadTimeHours: number;
  validFrom: string;
  validTo: string;
  changedBy?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ApproverLimit".
 */
export interface ApproverLimit {
  userId: string;
  role: "approver";
  plant: string;
  limitUsd: number;
  validFrom: string;
  validTo: string;
  grantedBy?: string | null;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "SupplierReliability".
 */
export interface SupplierReliability {
  supplierId: string;
  material: string;
  windowDays: number;
  sampleSize: number;
  onTimeRate: number;
  meanDelayDays: number;
  p90DelayDays: number;
  partialRate: number;
  computedAt: string;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "DialogueMessage".
 */
export interface DialogueMessage {
  messageId: string;
  caseId: string;
  direction: "OUTBOUND" | "INBOUND";
  supplierId: string;
  language: string;
  templateId?: string | null;
  renderedText: string;
  englishCopy: string;
  referenceToken: string;
  sentAt?: string | null;
  replySignalId?: string | null;
  status: "DRAFT" | "SENT" | "REPLIED" | "TIMED_OUT" | "BLOCKED";
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "Portfolio".
 */
export interface Portfolio {
  portfolioId: string;
  caseIds: string[];
  candidateActions: {
    [k: string]: unknown;
  }[];
  solverStatus: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "TIMEOUT";
  objective: number;
  savingVsSingle: number;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "ScenarioRun".
 */
export interface ScenarioRun {
  scenarioId: string;
  parameters: {
    [k: string]: unknown;
  };
  createdBy: string;
  outcome?: string | null;
  synthetic?: true;
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "EventEnvelope".
 */
export interface EventEnvelope {
  id?: string;
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
  time: string;
  env: string;
  caseId?: string | null;
  runId?: string | null;
  traceId?: string | null;
  actor: string;
  data: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `AeraContract`'s JSON-Schema
 * via the `definition` "TraceEvent".
 */
export interface TraceEvent {
  caseId: string;
  eventId?: string;
  runId?: string | null;
  kind: "AGENT" | "TOOL_CALL" | "TOOL_RESULT" | "CHECK" | "GUARD" | "SYSTEM";
  detail?: string | null;
  data?: {
    [k: string]: unknown;
  };
  ts: string;
}
