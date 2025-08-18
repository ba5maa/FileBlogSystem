FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /app
COPY . .

RUN dotnet publish ./FileBlogSystem/FileBlogSystem.csproj -c Release -o /app/out 



FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview
WORKDIR /app

COPY --from=build /app/out ./
COPY FileBlogSystem/Content /app/content
COPY FileBlogSystem/Config /app/config

EXPOSE 8080
ENTRYPOINT ["dotnet", "FileBlogSystem.dll"]
