import Feedback from '../models/Feedback.js';

export async function submit(req, res) {
  const { website, ...feedback } = req.body;
  // Bots that fill the hidden field get the same answer but nothing is stored.
  if (!website) await Feedback.create(feedback);
  res.status(201).json({ message: 'Thank you. Your message has been received.' });
}
