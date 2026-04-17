import { memo, type HTMLAttributes } from "react";

import Avatar from "@/components/ui/Avatar";

export interface RelicAvatarProps extends HTMLAttributes<HTMLDivElement> {
  readonly name: string;
  readonly src?: string;
  readonly alt?: string;
  readonly size?: "sm" | "md" | "lg";
}

function RelicAvatarBase({ name, src, alt, size = "md", className, ...props }: RelicAvatarProps) {
  return <Avatar name={name} src={src} alt={alt} size={size} className={className} {...props} />;
}

const RelicAvatar = memo(RelicAvatarBase);
RelicAvatar.displayName = "RelicAvatar";

export { RelicAvatar };
export default RelicAvatar;
