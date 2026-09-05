import type { WorkflowDefinition } from '@ai-config/host-api';
import { DevWorkflowAppComponent } from './dev/dev-frontend/src/dev-workflow-app.component';
import { MultimediaWorkflowAppComponent } from './multimedia/multimedia-frontend/src/multimedia-workflow-app.component';
import { AccountingWorkflowAppComponent } from './accounting/accounting-frontend/src/accounting-workflow-app.component';
import { RealEstateBrokerageWorkflowAppComponent } from './real-estate-brokerage/real-estate-brokerage-frontend/src/real-estate-brokerage-workflow-app.component';

const noProjectCreator = {
  kind: 'default' as const,
  title: 'Create project',
  createUrl: '',
};

export function localWorkflowDefinitions(): WorkflowDefinition[] {
  return [
    {
      id: 'dev',
      title: 'Development',
      icon: 'D',
      description: 'Development terminal workflow.',
      projectCreator: noProjectCreator,
      create: (context) => {
        const projectPath = context.host.currentContext().projectPath;
        if (!projectPath) {
          return {
            id: 'dev',
            title: 'Development',
            view: () => ({
              kind: 'context-required' as const,
              context: 'project' as const,
              recoveryPanels: ['projects' as const],
            }),
          };
        }
        DevWorkflowAppComponent.configure(context, context.host);
        return {
          id: 'dev',
          title: 'Development',
          view: () => ({
            kind: 'angular-standalone-component',
            component: DevWorkflowAppComponent,
          }),
        };
      },
    },
    {
      id: 'multimedia',
      title: 'Multimedia',
      icon: 'M',
      description: 'Multimedia release workflow.',
      usesWorkflowCenterView: true,
      projectCreator: noProjectCreator,
      create: (context) => {
        const projectPath = context.host.currentContext().projectPath;
        if (!projectPath) {
          return {
            id: 'multimedia',
            title: 'Multimedia',
            view: () => ({
              kind: 'context-required' as const,
              context: 'project' as const,
              recoveryPanels: ['projects' as const],
            }),
          };
        }
        MultimediaWorkflowAppComponent.configure(context as never, context.host);
        return {
          id: 'multimedia',
          title: 'Multimedia',
          view: () => ({
            kind: 'angular-standalone-component',
            component: MultimediaWorkflowAppComponent,
          }),
        };
      },
    },
    {
      id: 'accounting',
      title: 'Accounting',
      icon: 'A',
      description: 'Accounting workflow.',
      usesWorkflowCenterView: true,
      projectCreator: noProjectCreator,
      create: (context) => {
        const projectPath = context.host.currentContext().projectPath;
        AccountingWorkflowAppComponent.configure({
          profileId: context.profileId,
          workflowId: 'accounting',
          projectId: context.projectId,
          projectPath,
          workflowCenterView: context.workflowCenterView,
          workflowSurfaceContext: context.workflowSurfaceContext,
        });
        return {
          id: 'accounting',
          title: 'Accounting',
          view: () => ({
            kind: 'angular-standalone-component' as const,
            component: AccountingWorkflowAppComponent,
          }),
        };
      },
    },
    {
      id: 'real-estate-brokerage',
      title: 'Registered Real Estate Brokerage',
      icon: 'R',
      description: 'Real estate brokerage workflow.',
      projectCreator: noProjectCreator,
      create: (context) => {
        RealEstateBrokerageWorkflowAppComponent.configure({
          profileId: context.profileId,
          workflowId: 'real-estate-brokerage',
          workflowCenterView: context.workflowCenterView,
          workflowSurfaceContext: context.workflowSurfaceContext,
        });
        return {
          id: 'real-estate-brokerage',
          title: 'Registered Real Estate Brokerage',
          view: () => ({
            kind: 'angular-standalone-component' as const,
            component: RealEstateBrokerageWorkflowAppComponent,
          }),
        };
      },
    },
  ];
}
