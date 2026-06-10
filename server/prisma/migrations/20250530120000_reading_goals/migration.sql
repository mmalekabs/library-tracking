-- CreateTable
CREATE TABLE "ReadingGoalSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "dailyPagesGoal" INTEGER,
    "dailyMinutesGoal" INTEGER,
    "yearlyBooksGoal" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingGoalSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReadingGoalSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP);
