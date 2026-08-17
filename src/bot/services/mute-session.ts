export class MuteSessionTracker {
  private activeSessions = new Set<string>();

  private key(guildId: string, voiceChannelId: string): string {
    return `${guildId}:${voiceChannelId}`;
  }

  activate(guildId: string, voiceChannelId: string): void {
    this.activeSessions.add(this.key(guildId, voiceChannelId));
  }

  deactivate(guildId: string, voiceChannelId: string): void {
    this.activeSessions.delete(this.key(guildId, voiceChannelId));
  }

  isActive(guildId: string, voiceChannelId: string): boolean {
    return this.activeSessions.has(this.key(guildId, voiceChannelId));
  }
}
