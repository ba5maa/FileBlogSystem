FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY FileBlogSystem/*.csproj ./
RUN dotnet restore

COPY FileBlogSystem/. ./
#RUN dotnet publish -c Release -o /app/publish /p:SelfContained=false /p:UseAppHost=false
#RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false
#COPY FileBlogSystem/wwwroot ./wwwroot
RUN dotnet publish -c Release -o /app/publish /p:SelfContained=false
# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final 
WORKDIR /app
COPY --from=build /app/publish .
COPY FileBlogSystem/Content ./Content
COPY FileBlogSystem/wwwroot ./wwwroot
ENTRYPOINT ["dotnet", "FileBlogSystem.dll"]
