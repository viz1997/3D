import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  full_name: text('full_name'),
  avatar_url: text('avatar_url'),
  stripe_customer_id: text('stripe_customer_id').unique(),
  role: userRoleEnum('role').default('user').notNull(),
  referral: text('referral'),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const pricingPlanEnvironmentEnum = pgEnum('pricing_plan_environment', [
  'test',
  'live',
])

export const pricingPlans = pgTable('pricing_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  environment: pricingPlanEnvironmentEnum('environment').notNull(),
  card_title: text('card_title').notNull(),
  card_description: text('card_description'),
  stripe_price_id: varchar('stripe_price_id', { length: 255 }),
  stripe_product_id: varchar('stripe_product_id', { length: 255 }),
  stripe_coupon_id: varchar('stripe_coupon_id', { length: 255 }),
  enable_manual_input_coupon: boolean('enable_manual_input_coupon')
    .default(false)
    .notNull(),
  payment_type: varchar('payment_type', { length: 50 }),
  recurring_interval: varchar('recurring_interval', { length: 50 }),
  trial_period_days: integer('trial_period_days'),
  price: numeric('price'),
  currency: varchar('currency', { length: 10 }),
  display_price: varchar('display_price', { length: 50 }),
  original_price: varchar('original_price', { length: 50 }),
  price_suffix: varchar('price_suffix', { length: 100 }),
  features: jsonb('features').default('[]').notNull(),
  is_highlighted: boolean('is_highlighted').default(false).notNull(),
  highlight_text: text('highlight_text'),
  button_text: text('button_text'),
  button_link: text('button_link'),
  display_order: integer('display_order').default(0).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  lang_jsonb: jsonb('lang_jsonb').default('{}').notNull(),
  benefits_jsonb: jsonb('benefits_jsonb').default('{}'),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    provider: text('provider').notNull(),
    provider_order_id: text('provider_order_id').notNull(),
    status: text('status').notNull(),
    order_type: text('order_type').notNull(),
    product_id: text('product_id'),
    plan_id: uuid('plan_id').references(() => pricingPlans.id, {
      onDelete: 'set null',
    }),
    price_id: varchar('price_id', { length: 255 }),
    amount_subtotal: numeric('amount_subtotal'),
    amount_discount: numeric('amount_discount').default('0'),
    amount_tax: numeric('amount_tax').default('0'),
    amount_total: numeric('amount_total').notNull(),
    currency: varchar('currency', { length: 10 }).notNull(),
    subscription_provider_id: text('subscription_provider_id'),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      userIdx: index('idx_orders_user_id').on(table.user_id),
      providerIdx: index('idx_orders_provider').on(table.provider),
      planIdIdx: index('idx_orders_plan_id').on(table.plan_id),
      providerProviderOrderIdUnique: unique(
        'idx_orders_provider_provider_order_id_unique'
      ).on(table.provider, table.provider_order_id),
    }
  }
)

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    plan_id: uuid('plan_id')
      .references(() => pricingPlans.id, { onDelete: 'restrict' })
      .notNull(),
    stripe_subscription_id: text('stripe_subscription_id').notNull().unique(),
    stripe_customer_id: text('stripe_customer_id').notNull(),
    price_id: varchar('price_id', { length: 255 }).notNull(),
    status: text('status').notNull(),
    current_period_start: timestamp('current_period_start', {
      withTimezone: true,
    }),
    current_period_end: timestamp('current_period_end', { withTimezone: true }),
    cancel_at_period_end: boolean('cancel_at_period_end').default(false).notNull(),
    canceled_at: timestamp('canceled_at', { withTimezone: true }),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    trial_start: timestamp('trial_start', { withTimezone: true }),
    trial_end: timestamp('trial_end', { withTimezone: true }),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      userIdx: index('idx_subscriptions_user_id').on(table.user_id),
      statusIdx: index('idx_subscriptions_status').on(table.status),
      planIdIdx: index('idx_subscriptions_plan_id').on(table.plan_id),
    }
  }
)

export const usage = pgTable('usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  subscription_credits_balance: integer('subscription_credits_balance')
    .default(0)
    .notNull(),
  one_time_credits_balance: integer('one_time_credits_balance')
    .default(0)
    .notNull(),
  balance_jsonb: jsonb('balance_jsonb').default('{}').notNull(),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const creditLogs = pgTable(
  'credit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    amount: integer('amount').notNull(),
    one_time_balance_after: integer('one_time_balance_after').notNull(),
    subscription_balance_after: integer('subscription_balance_after').notNull(),
    type: text('type').notNull(),
    notes: text('notes'),
    related_order_id: uuid('related_order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      userIdx: index('idx_credit_logs_user_id').on(table.user_id),
      typeIdx: index('idx_credit_logs_type').on(table.type),
      relatedOrderIdIdx: index('idx_credit_logs_related_order_id').on(
        table.related_order_id
      ),
    }
  }
)

export const postStatusEnum = pgEnum('post_status', [
  'draft',
  'published',
  'archived',
])

export const postVisibilityEnum = pgEnum('post_visibility', [
  'public',
  'logged_in',
  'subscribers',
])

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    language: varchar('language', { length: 10 }).notNull(),
    author_id: uuid('author_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    content: text('content'),
    description: text('description'),
    featured_image_url: text('featured_image_url'),
    is_pinned: boolean('is_pinned').default(false).notNull(),
    status: postStatusEnum('status').default('draft').notNull(),
    visibility: postVisibilityEnum('visibility').default('public').notNull(),
    published_at: timestamp('published_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      languageSlugUnique: unique('posts_language_slug_unique').on(
        table.language,
        table.slug
      ),
      authorIdIdx: index('idx_posts_author_id').on(table.author_id),
      statusIdx: index('idx_posts_status').on(table.status),
      visibilityIdx: index('idx_posts_visibility').on(table.visibility),
      languageStatusIdx: index('idx_posts_language_status').on(
        table.language,
        table.status
      ),
    }
  }
)

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      nameIdx: index('idx_tags_name').on(table.name),
    }
  }
)

export const postTags = pgTable(
  'post_tags',
  {
    post_id: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    tag_id: uuid('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.post_id, table.tag_id] }),
      postIdIdx: index('idx_post_tags_post_id').on(table.post_id),
      tagIdIdx: index('idx_post_tags_tag_id').on(table.tag_id),
    }
  }
)
