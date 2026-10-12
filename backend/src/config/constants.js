const applicationStatuses = [
  "draft",
  "submitted",
  "under-review",
  "offer-received",
  "visa-processing",
  "enrolled",
  "rejected",
  "withdrawn",
];

const validStatusTransitions = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under-review", "rejected", "withdrawn"],
  "under-review": ["offer-received", "rejected", "withdrawn"],
  "offer-received": ["visa-processing", "rejected", "withdrawn"],
  "visa-processing": ["enrolled", "rejected", "withdrawn"],
  enrolled: [],
  rejected: [],
  withdrawn: [],
};

module.exports = {
  applicationStatuses,
  validStatusTransitions,
};
