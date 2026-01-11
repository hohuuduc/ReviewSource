// Benchmark Testing Types

export interface Rule {
    no: string | number;
    description: string;
    target: string;
}

export interface RuleSet {
    language: string;
    critical_rules: Rule[];
    warning_rules: Rule[];
}

export interface ExpectedViolation {
    line: number;
    object: string;
    type: 'Critical' | 'Warning';
    rule: string;
}

export interface TestCase {
    id: string;
    category: string;
    sourceCode: string;
    expectedViolations: ExpectedViolation[];
}

export interface Dataset {
    language: string;
    testCases: TestCase[];
}

export interface ReviewIssue {
    line: number;
    object: string;
    type: 'Critical' | 'Warning';
    violated_rule: string;
    suggested_change: string;
}

export interface ModelConfig {
    name: string;
    model: string;
    think: 'low' | 'medium' | 'high' | boolean;
}

export interface RunResult {
    responseTimeMs: number;
    outputTokens: number;
    outputSpeedTps: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
}

export interface ModelResult {
    modelName: string;
    mode: string;
    runs: RunResult[];
    bestRun: RunResult;
    precision: number;
    recall: number;
    f1Score: number;
    accPerToken: number;
}

export interface BenchmarkResult {
    timestamp: string;
    datasets: {
        name: string;
        totalCases: number;
        totalExpectedViolations: number;
    }[];
    models: ModelResult[];
}
