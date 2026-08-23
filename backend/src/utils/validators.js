import Joi from 'joi';

export function validateCheckIn(data) {
  const schema = Joi.object({
    qrCode: Joi.string().required().max(100).trim()
  });
  return schema.validate(data);
}

export function validateWebhook(data) {
  const schema = Joi.object({
    printJobId: Joi.string().required(),
    status: Joi.string().required().valid('SUCCESS', 'FAILED'),
    completedAt: Joi.string().required().isoDate(),
    error: Joi.string().optional()
  });
  return schema.validate(data);
}
