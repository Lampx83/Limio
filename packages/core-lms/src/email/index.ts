export { sendEmail, type SendResult } from "./sender";
export {
  sendTemplatedEmail,
  renderTemplate,
  renderField,
  composeEmailHtml,
  type TemplateKey,
  type RenderedTemplate,
  type SendTemplatedEmailInput,
} from "./templates";
export {
  listTemplatesForScope,
  getTemplateForScope,
  saveTemplate,
  removeOrgOverride,
  listRevisions,
  revertToRevision,
  type TemplateScope,
  type AdminTemplateSummary,
  type AdminTemplateDetail,
  type AdminRevisionSummary,
} from "./admin";
export {
  createExamCodeBatch,
  toggleBatchItem,
  cancelBatch,
  approveBatchAndSend,
  resendFailedItems,
  getBatchWithItems,
  listBatchesForExam,
  DispatchError,
  type CreateExamCodeBatchInput,
  type CreateExamCodeBatchResult,
  type ApproveBatchResult,
  type ResendFailedResult,
} from "./dispatch";
