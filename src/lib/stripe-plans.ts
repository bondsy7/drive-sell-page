// Mapping between subscription_plans slugs and Stripe price IDs
export const STRIPE_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: {
    monthly: 'price_1T8hVQP3eWRHEALNj9S6p0Ci',
    yearly: 'price_1T8jl2P3eWRHEALNgN05G4uH',
  },
  pro: {
    monthly: 'price_1T8hW0P3eWRHEALN6oM3lCnH',
    yearly: 'price_1T8kGPP3eWRHEALNfEabkqKC',
  },
  enterprise: {
    monthly: 'price_1T8hZFP3eWRHEALNKgntuNEe',
    yearly: 'price_1T8kH6P3eWRHEALNMOPfmibG',
  },
};

// Stripe product IDs per plan slug
export const STRIPE_PRODUCTS: Record<string, string> = {
  starter: 'prod_U6vMgZiKJOuEph',
  pro: 'prod_U6vMFLF7W8nh43',
  enterprise: 'prod_U6vQHQJucwwipk',
};
