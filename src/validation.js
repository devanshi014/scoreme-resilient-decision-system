const { z } = require("zod");

const applicationSchema = z.object({
  applicationId: z.string().min(1).max(100),
  applicant: z.object({
    name: z.string().trim().min(1),
    age: z.number().int().min(0).max(120),
    monthlyIncome: z.number().nonnegative(),
    identityVerified: z.boolean().optional()
  }),
  financial: z.object({
    debtToIncome: z.number().min(0).max(10)
  }),
  simulateDependencyFailure: z.boolean().optional()
}).strict();

module.exports = { applicationSchema };
