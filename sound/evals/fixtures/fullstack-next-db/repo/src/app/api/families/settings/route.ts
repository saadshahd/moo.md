import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import neo4j from "neo4j-driver";
import {
  FamilySettings,
  SettingsFormData,
  DEFAULT_FAMILY_VALUES,
  DEFAULT_EMOTIONAL_BOUNDARIES,
  DEFAULT_SAFETY_PREFERENCES,
  DEFAULT_NOTIFICATION_SETTINGS,
  FamilyValue,
} from "@/types/settings";

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI || "bolt://neo4j:7687",
  neo4j.auth.basic(
    process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASSWORD || "localpassword",
  ),
  {
    encrypted: false,
    trust: "TRUST_ALL_CERTIFICATES",
  },
);

const generateDefaultSettings = (userId: string): FamilySettings => {
  const now = new Date();

  return {
    id: `settings-${userId}`,
    familyId: userId, // Using userId as familyId for MVP
    familyValues: DEFAULT_FAMILY_VALUES.map((value, index) => ({
      value,
      priority: index + 1,
      isCustom: false,
    })),
    emotionalBoundaries: DEFAULT_EMOTIONAL_BOUNDARIES,
    safetyPreferences: DEFAULT_SAFETY_PREFERENCES,
    notifications: DEFAULT_NOTIFICATION_SETTINGS,
    autoSaveEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
};

async function getSettingsFromDB(
  userId: string,
): Promise<FamilySettings | null> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[:HAS_SETTINGS]->(s:FamilySettings)
      RETURN s
      `,
      { userId },
    );

    if (result.records.length === 0) {
      return null;
    }

    const settingsNode = result.records[0].get("s").properties;

    // Parse JSON fields back to objects
    return {
      id: settingsNode.id,
      familyId: settingsNode.familyId,
      familyValues: JSON.parse(settingsNode.familyValues),
      emotionalBoundaries: JSON.parse(settingsNode.emotionalBoundaries),
      safetyPreferences: JSON.parse(settingsNode.safetyPreferences),
      notifications: JSON.parse(settingsNode.notifications),
      autoSaveEnabled: settingsNode.autoSaveEnabled,
      createdAt: new Date(settingsNode.createdAt),
      updatedAt: new Date(settingsNode.updatedAt),
    };
  } finally {
    await session.close();
  }
}

async function saveSettingsToDB(
  userId: string,
  settings: FamilySettings,
): Promise<void> {
  const session = driver.session();
  try {
    await session.run(
      `
      MERGE (u:User {id: $userId})
      MERGE (u)-[:HAS_SETTINGS]->(s:FamilySettings {id: $settingsId})
      SET s.familyId = $familyId,
          s.familyValues = $familyValues,
          s.emotionalBoundaries = $emotionalBoundaries,
          s.safetyPreferences = $safetyPreferences,
          s.notifications = $notifications,
          s.autoSaveEnabled = $autoSaveEnabled,
          s.createdAt = $createdAt,
          s.updatedAt = $updatedAt
      `,
      {
        userId,
        settingsId: settings.id,
        familyId: settings.familyId,
        familyValues: JSON.stringify(settings.familyValues),
        emotionalBoundaries: JSON.stringify(settings.emotionalBoundaries),
        safetyPreferences: JSON.stringify(settings.safetyPreferences),
        notifications: JSON.stringify(settings.notifications),
        autoSaveEnabled: settings.autoSaveEnabled,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString(),
      },
    );
  } finally {
    await session.close();
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // Get settings from database or create defaults
    let settings = await getSettingsFromDB(userId);

    if (!settings) {
      settings = generateDefaultSettings(userId);
      await saveSettingsToDB(userId, settings);
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error retrieving family settings:", error);
    return NextResponse.json(
      { error: "Failed to retrieve settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Validate required fields are present
    if (
      !body.familyValues ||
      !body.emotionalBoundaries ||
      !body.safetyPreferences ||
      !body.notifications
    ) {
      return NextResponse.json(
        { error: "Missing required settings fields" },
        { status: 400 },
      );
    }

    // Get existing settings from database or create defaults
    let existingSettings = await getSettingsFromDB(userId);
    if (!existingSettings) {
      existingSettings = generateDefaultSettings(userId);
    }

    // Update the settings
    const updatedSettings: FamilySettings = {
      ...existingSettings,
      familyValues: body.familyValues,
      emotionalBoundaries: body.emotionalBoundaries,
      safetyPreferences: body.safetyPreferences,
      notifications: body.notifications,
      updatedAt: new Date(),
    };

    // Save updated settings to database
    await saveSettingsToDB(userId, updatedSettings);

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("Error updating family settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
