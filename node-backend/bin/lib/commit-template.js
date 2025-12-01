/**
 * Local commit mesajı üretici
 * API call yapmadan commit mesajı oluşturur
 */

function buildCommitMessage(group, options = {}) {
    const { jiraInfo, config } = options;
    const title = group.title || group.summary || 'changes';
    const summary = group.summary || '';

    if (jiraInfo) {
        // JIRA bilgisi varsa: PREFIX-NUMBER: title formatı
        const prefix = config?.commitPrefix || jiraInfo.prefix;
        const ticketId = `${prefix}-${jiraInfo.number}`;
        const jiraUrl = config?.jira?.baseUrl
            ? `${config.jira.baseUrl}/browse/${ticketId}`
            : null;

        const lines = [
            `${ticketId}: ${title}`,
            '',
            summary,
        ];

        if (jiraUrl) {
            lines.push('', jiraUrl);
        }

        return lines.join('\n').trim();
    }

    // JIRA yoksa: basit format
    const lines = [
        title,
        '',
        summary,
    ];

    if (config?.project?.key) {
        lines.push('', `(Project: ${config.project.key})`);
    }

    return lines.join('\n').trim();
}

function buildCommitMessageFromGroups(groups, options = {}) {
    // Birden fazla grup tek commit'te birleştirilecekse
    const { jiraInfo, config } = options;

    if (groups.length === 1) {
        return buildCommitMessage(groups[0], options);
    }

    const titles = groups.map(g => g.title || g.summary).filter(Boolean);
    const combinedTitle = titles.join(', ');

    return buildCommitMessage({
        title: combinedTitle,
        summary: groups.map(g => `- ${g.summary || g.title}`).join('\n')
    }, options);
}

module.exports = {
    buildCommitMessage,
    buildCommitMessageFromGroups
};