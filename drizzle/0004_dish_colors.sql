-- The colour moves from the category to the dish.
--
-- Two dishes of the same section can now be told apart on sight, which is
-- what the colour was asked to do. The category keeps its job - grouping the
-- card into sections - and loses its colour.
--
-- This migration only ADDS. `categories.color` is deliberately left in place:
-- the pipeline applies migrations before the new code goes live, so dropping
-- a column the running Worker still reads would break it for the length of a
-- build. It goes in a follow-up migration, once the code that reads it is no
-- longer deployed anywhere. Expanding now, contracting later, costs one extra
-- release and no downtime at all.

-- Every dish already on the card turns white. White is the neutral token:
-- the card looks exactly as it did the day before, and a colour appears only
-- where somebody chooses to put one.
ALTER TABLE `dishes` ADD `color` text DEFAULT 'blanc' NOT NULL;
--> statement-breakpoint
-- With one exception, and it is not an exception to the rule above: a
-- category that was given a colour between the two releases passes it down to
-- its dishes rather than throwing it away. Everything untouched was white,
-- so everything untouched stays white.
UPDATE `dishes` SET `color` = (
	SELECT `color` FROM `categories` WHERE `categories`.`id` = `dishes`.`category_id`
)
WHERE `category_id` IS NOT NULL;
