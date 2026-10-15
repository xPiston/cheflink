-- Categories become rows with a colour, and an order is called out by a
-- number instead of a table.
--
-- Written by hand rather than generated, for one reason that matters: SQLite
-- cannot add a NOT NULL column pointing at another table, and drizzle-kit's
-- answer to that is to rebuild the table - create a copy, move the rows, DROP
-- the original. Dropping `dishes` or `orders` here would be destructive: with
-- foreign keys on, DROP TABLE performs an implicit DELETE FROM, which fires
-- `order_items.dish_id ON DELETE SET NULL` and, worse,
-- `order_items.order_id ON DELETE CASCADE`. The history would come out of the
-- migration stripped of its dish references, or emptied outright.
--
-- So nothing is rebuilt here. Every step is ADD COLUMN, UPDATE or DROP
-- COLUMN, and the two columns that ought to be NOT NULL but cannot be are
-- held so by the validators instead - see the comments in src/db/schema.ts.

CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'blanc' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);
--> statement-breakpoint
-- One category per distinct name already on the card, every one of them
-- white: the card looks exactly as it did yesterday, and a colour shows up
-- only where somebody chooses to put one.
--
-- The id is a v4 UUID built in SQL, because that is what the rest of the
-- application generates and what the validators check (`z.string().uuid()`).
-- `(random() % 4 + 4) % 4` rather than `abs(random()) % 4`: abs() of the
-- smallest 64-bit integer overflows, and a migration is a bad place to meet a
-- one-in-eighteen-quintillion error.
INSERT INTO `categories` (`id`, `name`, `color`, `created_at`)
SELECT
	lower(hex(randomblob(4))) || '-' ||
	lower(hex(randomblob(2))) || '-4' ||
	substr(lower(hex(randomblob(2))), 2) || '-' ||
	substr('89ab', 1 + (random() % 4 + 4) % 4, 1) ||
	substr(lower(hex(randomblob(2))), 2) || '-' ||
	lower(hex(randomblob(6))),
	`category`,
	'blanc',
	unixepoch() * 1000
FROM `dishes`
GROUP BY `category`;
--> statement-breakpoint
ALTER TABLE `dishes` ADD `category_id` text REFERENCES categories(id);
--> statement-breakpoint
UPDATE `dishes` SET `category_id` = (
	SELECT `id` FROM `categories` WHERE `categories`.`name` = `dishes`.`category`
);
--> statement-breakpoint
CREATE INDEX `idx_dishes_category` ON `dishes` (`category_id`);
--> statement-breakpoint
ALTER TABLE `dishes` DROP COLUMN `category`;
--> statement-breakpoint
ALTER TABLE `orders` ADD `number` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `service_day` text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Past orders are numbered too, rather than left at 0: the history is read
-- by the same people, and a column of zeroes would say the feature arrived
-- and the past did not exist.
--
-- `-4 hours` is UTC standing in for "five in the morning, Paris time" - the
-- rule `serviceDay()` applies in src/lib/orders.ts. SQLite has no timezone
-- database, so Paris is taken as UTC+1 all year; the only rows this misfiles
-- are those sent between five and six in the morning during summer time, and
-- nothing is served then.
UPDATE `orders` SET `service_day` = date(`created_at` / 1000, 'unixepoch', '-4 hours');
--> statement-breakpoint
-- Count of the orders of the same service that came first, plus itself. Ties
-- on the millisecond are broken by the id so that the result is one fixed
-- numbering and not whatever order the rows came back in.
UPDATE `orders` SET `number` = (
	SELECT COUNT(*) FROM `orders` AS `earlier`
	WHERE `earlier`.`service_day` = `orders`.`service_day`
		AND (
			`earlier`.`created_at` < `orders`.`created_at`
			OR (`earlier`.`created_at` = `orders`.`created_at` AND `earlier`.`id` <= `orders`.`id`)
		)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_service_day_number` ON `orders` (`service_day`,`number`);
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `table_label`;
