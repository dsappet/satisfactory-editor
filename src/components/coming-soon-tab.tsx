import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoonTab({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
    </Card>
  );
}
