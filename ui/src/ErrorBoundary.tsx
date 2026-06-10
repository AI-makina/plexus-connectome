import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    errorMessage: string;
    errorStack: string;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        errorMessage: "",
        errorStack: ""
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error.message, errorStack: error.stack || "" };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private copyReport = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(`${this.state.errorMessage}\n${this.state.errorStack}`);
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-screen items-center justify-center overflow-y-auto bg-ink-1 px-6">
                    <div className="w-full max-w-[640px] rounded-lg border border-line bg-ink-2 p-6" style={{ borderTop: '2px solid var(--risk-critical)' }}>
                        <div className="micro-label" style={{ color: 'var(--risk-critical)' }}>System Fault</div>
                        <p className="mt-3 text-sm leading-relaxed text-text-hi">{this.state.errorMessage}</p>
                        <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-ink-3 p-3 font-mono text-[11px] leading-relaxed text-text-mid">
                            {this.state.errorStack}
                        </pre>
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={() => location.reload()}
                                className="h-9 rounded bg-text-hi px-4 text-[13px] font-semibold text-[#0B0C0E] transition-colors duration-120 hover:bg-white active:scale-[0.99]"
                            >
                                Reload
                            </button>
                            <button
                                onClick={this.copyReport}
                                className="h-9 rounded border border-line px-4 text-[13px] text-text-mid transition-colors duration-120 hover:border-line-strong hover:text-text-hi"
                            >
                                Copy report
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
