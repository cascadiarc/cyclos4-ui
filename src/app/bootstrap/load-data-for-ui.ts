
// Load the DataForUi before showing the application
import { FormatService } from "app/core/format.service";
import { UIService } from "app/api/services";
import { UiKind, DataForUi } from "app/api/models";
import { Provider, APP_INITIALIZER, Injector } from "@angular/core";

import { environment } from "environments/environment"
import { ApiInterceptor } from "app/core/api.interceptor";
import { HttpErrorResponse } from "@angular/common/http/src/response";
import { ErrorHandlerService } from "app/core/error-handler.service";

export function loadDataForUi(injector: Injector): Function {

  let init = (dataForUi: DataForUi) => {
    // Initialize the FormatService
    let formatService = injector.get(FormatService);
    formatService.initialize(dataForUi);

    // Initialize the favorite icon
    let pageIcon = document.getElementById("pageIcon") as HTMLLinkElement;
    pageIcon.href = formatService.getLogoUrl('SHORTCUT_ICON');

    // Initialize the body lang
    document.body.lang = dataForUi.language.code;

    return dataForUi;
  }

  if (environment.dataForUi) {
    // The DataForUi is hardcoded in the environment - just get it
    return () => {
      return init(environment.dataForUi)
    }
  } else {
    // Fetch from the server
    let params: UIService.DataForUiParams = {
      kind: UiKind.PAY,
      themeIf: "false",
      headerIf: "false",
      footerIf: "false"
    }
    return () => {
      let uiService = injector.get(UIService);
      let interceptor = injector.get(ApiInterceptor);
      // Set the interceptor to ignore any errors. In case some occurred, will retry once.
      interceptor.ignoreNextError();
      uiService.dataForUi(params)
      .subscribe(init, (error: HttpErrorResponse) => {
        if (error.status == 401) {
          // Had an invalid session token. Clear it and try again.
          interceptor.sessionToken = null;
          uiService.dataForUi(params).subscribe(init);
        } else {
          // Handle the error
          injector.get(ErrorHandlerService).handleHttpError(error);
        }
      });
    };
  }
}
export const LOAD_DATA_FOR_UI: Provider = {
  provide: APP_INITIALIZER,
  useFactory: loadDataForUi,
  deps: [Injector],
  multi: true
};
