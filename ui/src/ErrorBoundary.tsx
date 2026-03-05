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

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col h-screen w-screen p-10 bg-black text-red-500 font-mono overflow-auto z-50">
                    <h1 className="text-3xl font-bold mb-4">React Fatal Crash 💥</h1>
                    <p className="text-xl font-bold text-white mb-2">{this.state.errorMessage}</p>
                    <pre className="text-sm bg-gray-900 p-4 rounded text-red-400 whitespace-pre-wrap">
                        {this.state.errorStack}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
