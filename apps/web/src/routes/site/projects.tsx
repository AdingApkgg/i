import { Card, CardBody } from "@i/ui";
import { ArrowUpRight, ExternalLink, GitFork } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { thumbProps } from "@/lib/thumb";
import type { Route } from "./+types/projects";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.project.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) =>
  seo(args, {
    title: "作品",
    path: "/projects",
    description: "自己写和自己在维护的东西：在线站、镜像、工具和一些玩具。",
  });

type Project = Route.ComponentProps["loaderData"]["items"][number];

function ProjectCard({ project }: { project: Project }) {
  return (
    <Card className="group h-full overflow-hidden transition hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-16/10 w-full overflow-hidden bg-gradient-to-br from-soft via-card to-soft">
        {project.imageUrl ? (
          <img
            {...thumbProps(
              project.imageUrl,
              [640, 1280, 1920],
              "(min-width: 1024px) 45vw, (min-width: 640px) 90vw, 100vw",
            )}
            alt={`${project.name} 截图`}
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-103"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-primary/35">
            <span className="text-caption tracking-kicker uppercase">{project.tag ?? "作品"}</span>
          </div>
        )}
        {project.tag && (
          <Badge className="absolute top-3 left-3 bg-card/85 backdrop-blur">{project.tag}</Badge>
        )}
      </div>
      <CardBody className="space-y-2">
        <h3 className="text-base font-semibold break-words">{project.name}</h3>
        {project.description && (
          <p className="text-sm leading-relaxed break-words text-muted-foreground">
            {project.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
          {project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              前往
            </a>
          )}
          {project.repo && (
            <a
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <GitFork className="size-3.5" />
              源码
            </a>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export default function ProjectsPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="作品" subtitle="自己写、自己在维护" />
      {items.length === 0 ? (
        <EmptyCard>还没有作品。</EmptyCard>
      ) : (
        <>
          <FadeIn>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge>共 {items.length} 个</Badge>
              <span>自己写着玩，也顺手解决自己的痒处</span>
              <ArrowUpRight className="size-3.5 text-primary" />
            </p>
          </FadeIn>
          <Stagger className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((project) => (
              <StaggerItem key={project.id} hover>
                <ProjectCard project={project} />
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </>
  );
}
