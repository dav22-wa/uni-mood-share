interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: "sm" | "md" | "lg";
}

export const OnlineIndicator = ({ isOnline, size = "md" }: OnlineIndicatorProps) => {
  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  if (!isOnline) return null;

  return (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-full bg-green-500 border-2 border-background animate-pulse`}
      />
    </div>
  );
};
