import { z } from 'zod'

export const quizSchema = z.object({
  title: z.string().trim().min(1).max(80),
  questions: z.array(z.object({
    text: z.string().trim().min(1).max(200),
    options: z.array(z.string().trim().min(1).max(100)).min(2).max(4),
    correct: z.number().int().min(0).max(3),
    seconds: z.number().int().min(5).max(60)
  }).refine((q) => q.correct < q.options.length, 'correct index out of range')).min(1).max(30)
})

export const codeSchema = z.string().trim().toUpperCase().length(5)
